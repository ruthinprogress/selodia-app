import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding-question';
import { useOnboardingAction } from '@/components/onboarding-action';
import { TapChoices } from '@/components/tap-choices';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import {
  LOAD_FAILED_MESSAGE,
  LOAD_RETRY_LABEL,
  mayContinue,
  mayWrite,
  type LoadState,
} from '@/lib/load-state';
import { supabase } from '@/lib/supabase';
import { planWeekWrite } from '@/lib/week-write-plan';

// SCREEN 4: WHAT SHE ALREADY DOES. This is what fills My Week.
//
// IT ASKS WHAT SHE DOES, NOT WHAT SHE SHOULD DO, and the difference is the
// whole screen. Every other app in this market opens by assigning a programme.
// This one starts from her actual life and gives it a shape, which is what
// "a rhythm to work with" means in the brief.
//
// THE FREQUENCIES ARE VAGUE ON PURPOSE. "Now and then", "most days" - not
// "3x per week". A precise number invites a comparison against a precise
// number, and this screen has no business creating something to fall short of.
// They are stored as the words she picked and shown back as the words she
// picked.
//
// NOTHING HERE IS A COMMITMENT. The week is a description. The spec's hard rule
// holds: nothing in it is ever marked done or missed.
//
// EVERY ACTIVITY TAPPED HERE BECOMES A WEEK ROW, with its frequency and no day.
// `user_week.days` defaults to '{}', so a row needs no day to exist - the day is
// something chat can add later, or never. Ruth, 2 October: "Each activity she
// taps in setup, with its frequency, creates a Week row (activity plus cadence,
// no day needed)."

const QUESTION = 'What do you already do?';
const SUBTITLE = 'Whatever is actually in your week. Nothing here is a commitment.';

// The starting set, not a vocabulary. Anything else is added by saying so in
// chat, the same way everything else in this app is.
const ACTIVITIES = [
  { key: 'walking', label: 'Walking' },
  { key: 'running', label: 'Running' },
  { key: 'gym', label: 'Gym or weights' },
  { key: 'yoga', label: 'Yoga' },
  { key: 'pilates', label: 'Pilates' },
  { key: 'swimming', label: 'Swimming' },
  { key: 'cycling', label: 'Cycling' },
  { key: 'dance', label: 'Dance or ballet' },
  { key: 'calisthenics', label: 'Bar work or calisthenics' },
  { key: 'classes', label: 'Classes of some kind' },
] as const;

type ActivityKey = (typeof ACTIVITIES)[number]['key'];

const CADENCES = [
  { key: 'now_and_then', label: 'Now and then' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'few_times', label: 'A few times a week' },
  { key: 'most_days', label: 'Most days' },
] as const;

type CadenceKey = (typeof CADENCES)[number]['key'];

// Stored as the words she picked, so the week reads back in her own terms.
const CADENCE_WORDS: Record<CadenceKey, string> = {
  now_and_then: 'Now and then',
  weekly: '1x/week',
  few_times: 'A few times a week',
  most_days: 'Most days',
};

// Back the other way, so a redo can show her the frequency she already gave.
// Chat writes cadences in its own words, so anything unrecognised simply leaves
// the frequency chips unset rather than guessing which of the four it meant.
const CADENCE_KEYS: Record<string, CadenceKey> = Object.fromEntries(
  (Object.keys(CADENCE_WORDS) as CadenceKey[]).map((k) => [CADENCE_WORDS[k], k])
);

// The everyday-activity level the TDEE estimate needs, from what she actually
// picked. The busiest answer wins: somebody who walks most days and swims now
// and then is not sedentary.
function activityLevelFrom(picked: (CadenceKey | undefined)[]): string {
  const set = new Set(picked.filter(Boolean) as CadenceKey[]);
  if (set.has('most_days')) return 'active';
  if (set.has('few_times')) return 'moderate';
  if (set.has('weekly') || set.has('now_and_then')) return 'light';
  return 'sedentary';
}

export default function ActivitiesScreen() {
  const theme = useTheme();
  const [chosen, setChosen] = useState<ActivityKey[]>([]);
  const [cadences, setCadences] = useState<Partial<Record<ActivityKey, CadenceKey>>>({});
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // HER WEEK AS IT STANDS, READ BEFORE ANYTHING CAN BE OVERWRITTEN BY IT.
  //
  // Ruth, 2 October 2026: "Redo is an EDIT MODE. Pull every current selection
  // from where it is kept and show it selected."
  //
  // It is also the guard for item 1, and the two are the same fact. An empty
  // `chosen` is ambiguous until this has run: it means either "she deselected
  // everything" or "the screen has not loaded yet". The old code could not tell,
  // treated both as the first, and deleted her week on the second. Nothing may
  // be written until the screen knows which it is - so Continue stays disabled
  // until `loaded`, and `save` refuses outright if it is somehow pressed anyway.
  // THREE STATES, NOT A BOOLEAN. `loaded: false` meant both "not yet" and "it
  // failed", and the second inherited the treatment built for the first: a dead
  // Continue and no message, forever. See lib/load-state.ts.
  const [loadState, setLoadState] = useState<LoadState>('loading');
  /** Bumped by Try again, which re-runs the read. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      advanceOnboardingStep(supabase, user.id, 'activities');

      const [{ data: weekRows, error: weekError }, { data: profile }] = await Promise.all([
        supabase.from('user_week').select('activity, cadence').eq('user_id', user.id),
        supabase.from('user_profile').select('height_cm').eq('user_id', user.id).maybeSingle(),
      ]);
      if (!live) return;

      // A FAILED READ IS NOT AN EMPTY WEEK. If this throws and the screen still
      // declares itself loaded, every chip is unselected for a reason that has
      // nothing to do with her, and Continue reads that as "remove all of them".
      // Staying unloaded keeps Continue disabled, which is the safe failure.
      if (weekError) {
        setLoadState('failed');
        return;
      }

      const picked: ActivityKey[] = [];
      const words: Partial<Record<ActivityKey, CadenceKey>> = {};
      for (const row of weekRows ?? []) {
        // Only this screen's own ten can be shown as chips. A French class added
        // in chat has no chip to light up, and must not be invented one - it
        // simply is not this screen's to show, or to remove.
        const match = ACTIVITIES.find((a) => (a.label as string) === String(row.activity));
        if (!match) continue;
        picked.push(match.key);
        const cadenceKey = row.cadence ? CADENCE_KEYS[String(row.cadence)] : undefined;
        if (cadenceKey) words[match.key] = cadenceKey;
      }
      setChosen(picked);
      setCadences(words);
      if (typeof profile?.height_cm === 'number') setHeight(String(profile.height_cm));
      setLoadState('ready');
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  function toggle(key: ActivityKey) {
    setChosen((prev) => {
      if (prev.includes(key)) {
        setCadences((c) => {
          const next = { ...c };
          delete next[key];
          return next;
        });
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }

  async function save(): Promise<boolean> {
    // NOTHING IS WRITTEN FROM A SCREEN THAT HAS NOT READ HER WEEK YET. See
    // `loaded` above: before the pre-fill lands, an empty `chosen` is the
    // screen's own ignorance and not her answer.
    // NOTHING IS WRITTEN WITHOUT HER WEEK IN HAND. The one property worth
    // keeping from the original design: an empty chip row must never be read as
    // "she deselected everything", which is what deleted her week on 1 October.
    if (!mayWrite(loadState)) return true;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    // THIS SCREEN DELETED HER ENTIRE WEEK (1 October 2026, ~19:05).
    //
    // The two lines that used to be here said:
    //
    //   "Only the rows onboarding put there are replaced. Anything added later
    //    in chat is hers and is not this screen's to remove."
    //
    // ...immediately above `.delete().eq('user_id', user.id)`, which removes
    // EVERY row she has. The comment described an intention nobody implemented,
    // and it read so reasonably that it survived several reviews including mine.
    //
    // WHAT IT COST. Ruth opened "redo my setup" to review the wording, walked to
    // this screen, and continued. Gym on Wednesdays and her French class on
    // Thursday - both of which she had added through chat four hours earlier -
    // were deleted. Nothing was written in their place, because the delete ran
    // BEFORE the early return for "nothing chosen": walking onto this screen and
    // pressing Continue with no chips selected wiped the table and saved nothing.
    //
    // THE FIRST FIX WAS HALF A FIX, AND THE CHECK AGREED WITH IT (2 October).
    //
    // 1 October's repair scoped the delete to this screen's own activities and
    // added `if (chosen.length === 0) return true;` - BELOW the delete. So the
    // destructive path survived in a narrower form: open the redo, press
    // Continue without touching a chip, and every one of the ten labels was
    // removed, because `keep` was empty and the early return came too late to
    // matter. Her French class survived; Gym, Pilates and Dance did not.
    //
    // `check-setup-destroys-nothing.mjs` was written to catch exactly this, and
    // passed, because its assertion ended in `|| ...includes('toRemove')` - an
    // escape hatch admitting the shape it existed to reject. A check with an
    // exception for the current code cannot fail on the current code.
    //
    // WHAT ACTUALLY FIXES IT is not a better-placed guard but knowing her week
    // before offering to change it. The screen now loads her current rows and
    // shows them selected, so `chosen` is her answer rather than a blank, and
    // the three properties below follow from that:
    //
    //   1. A redo she walks through without touching anything writes back the
    //      selection it displayed, which changes nothing.
    //   2. Only THIS SCREEN'S OWN ACTIVITIES can be removed. The ten labels
    //      below are the only things this screen can create, so anything else in
    //      her week - a French class, anything chat added - is hers and is left
    //      alone. That is what the comment above claimed and this now does.
    //   3. An activity she keeps is UPDATED, not deleted and re-made. Re-running
    //      setup used to throw away the day she had chosen and the time she had
    //      given, because a new row has neither. Her Wednesday survives.
    //
    // And deselecting is still a real removal, which is item 4's requirement:
    // taking a chip off and pressing Continue overwrites, so nothing duplicates.
    //
    // THE DECISION ITSELF LIVES IN `planWeekWrite`, not here, so that it can be
    // run by something other than a phone. See lib/week-write-plan.ts: the
    // reason the half-fix survived a day is that its only guard was a check
    // reading this file as text, and that check had an exception for the shape
    // the file had. `scripts/check-week-write-plan.mjs` puts the function in the
    // exact state that cost her Gym, Pilates and Dance and asserts it plans
    // nothing - twelve cases, including every subset of the chips.
    //
    // Widened to string: ACTIVITIES is `as const`, so its labels are a literal
    // union, and what comes back from the database is any string at all.
    const ownLabels: string[] = ACTIVITIES.map((a) => a.label);

    const { data: existingRows, error: readError } = await supabase
      .from('user_week')
      .select('id, activity, cadence, sort_order')
      .eq('user_id', user.id);
    if (readError) return false;

    const plan = planWeekWrite({
      // The plan refuses outright unless her week is in hand. Same guarantee as
      // before, now expressed through the three-state read rather than a boolean
      // that could not tell "not yet" from "it failed".
      loaded: mayWrite(loadState),
      existing: (existingRows ?? []).map((r) => ({
        id: String(r.id),
        activity: String(r.activity),
        cadence: r.cadence === null || r.cadence === undefined ? null : String(r.cadence),
        sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
      })),
      ownLabels,
      chosen: chosen.map((key) => {
        const activity = ACTIVITIES.find((a) => a.key === key)!.label as string;
        const cadence = cadences[key] ? CADENCE_WORDS[cadences[key]!] : null;
        return { activity, cadence };
      }),
    });
    // Refused, because her week had not been read. Nothing to report as failure:
    // Continue is disabled in that state, so this is defence, not a path.
    if (!plan) return false;

    if (plan.remove.length > 0) {
      const { error } = await supabase.from('user_week').delete().in('id', plan.remove);
      if (error) return false;
    }

    // ACTIVITY LEVEL AND HEIGHT COME FROM THIS SCREEN NOW, and they have to.
    //
    // Until tonight neither was collected by any onboarding SCREEN: the
    // conversational steps sent prose to the chat route and the model extracted
    // them. Replacing those screens with taps would have quietly removed the
    // only path to both - and without height there is no BMR, without BMR no
    // TDEE, and without TDEE no calorie target at all. Slice 1 would have fixed
    // the target and Slice 5 would have removed its inputs.
    //
    // Asking here is also better than inferring from prose: "a few times a
    // week" is a chosen answer, not a guess at what somebody meant.
    const level = activityLevelFrom(Object.values(cadences));
    const cm = Number(height.replace(/[^0-9.]/g, ''));
    const profilePatch: Record<string, unknown> = { activity_level: level };
    if (cm >= 100 && cm <= 230) profilePatch.height_cm = Math.round(cm);
    await supabase.from('user_profile').update(profilePatch).eq('user_id', user.id);

    // Already in her week: update the cadence she just gave and leave everything
    // else - her day, her time, the order - exactly as it was.
    for (const row of plan.updateCadence) {
      const { error } = await supabase
        .from('user_week')
        .update({ cadence: row.cadence })
        .eq('id', row.id);
      if (error) return false;
    }

    if (plan.insert.length === 0) return true;
    const { error } = await supabase.from('user_week').insert(
      plan.insert.map((row) => ({
        user_id: user.id,
        activity: row.activity,
        // NO PURPOSE LINE YET, and that is honest rather than lazy. The purpose
        // is why a thing is in her week, and nothing on this screen has asked
        // her. Chat fills it in once there is a conversation to fill it from;
        // inventing "cardio and bone density" for somebody who said "swimming"
        // would be the app putting words in her mouth on day one.
        purpose: null,
        cadence: row.cadence,
        // NO `days`. It defaults to '{}', and setup does not ask for a day.
        sort_order: row.sort_order,
      }))
    );
    return !error;
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/allergies');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/allergies');
  }

  useOnboardingAction({
    label: saving ? 'Saving…' : 'Continue',
    // Disabled until her week has been read. The pre-fill is normally faster
    // than she can look at the screen; the one case this covers is a slow or
    // failed read, where carrying on would overwrite her week with a blank.
    // Pressable once the read settles, either way. A failed read means this
    // screen does not write on the way past, not that she is stuck on it.
    enabled: mayContinue(loadState, saving),
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  return (
    <OnboardingQuestion question={QUESTION} subtitle={SUBTITLE}>
      <TapChoices options={ACTIVITIES} selected={chosen} onSelect={toggle} multi />

      {chosen.length > 0 && (
        <ThemedView style={{ gap: 16 }}>
          <ThemedText type="small">How often, roughly?</ThemedText>
          {chosen.map((key) => (
            <ThemedView key={key} style={{ gap: 8 }}>
              <ThemedText type="small" themeColor="textSecondary">
                {ACTIVITIES.find((a) => a.key === key)!.label}
              </ThemedText>
              <TapChoices
                options={CADENCES}
                selected={cadences[key] ? [cadences[key]!] : []}
                onSelect={(c) => setCadences((prev) => ({ ...prev, [key]: c }))}
              />
            </ThemedView>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Roughly is fine. This becomes the shape of your week, not a target to hit.
          </ThemedText>
        </ThemedView>
      )}

      {/* HEIGHT, ASKED PLAINLY AND ONLY ONCE. It is the one number the
          metabolic estimate cannot do without, and saying what it is for is
          what stops it feeling like an audit. */}
      <ThemedView style={{ gap: 8 }}>
        <ThemedText type="small">Roughly how tall are you?</ThemedText>
        <TextInput
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          placeholder="Height in cm"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Your height in centimetres"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Used for the metabolic estimate, and nothing else. Skip it and Selodía works without it.
        </ThemedText>
      </ThemedView>

      {/* SAID, RATHER THAN SHOWN AS AN EMPTY SCREEN. For two days a failed read
          on screens like this one looked identical to having nothing saved. */}
      {loadState === 'failed' && (
        <>
          <ThemedText type="small" themeColor="danger">
            {LOAD_FAILED_MESSAGE}
          </ThemedText>
          <ThemedText
            type="smallBold"
            themeColor="accentDeep"
            accessibilityRole="button"
            accessibilityLabel={LOAD_RETRY_LABEL}
            onPress={() => setAttempt((n) => n + 1)}>
            {LOAD_RETRY_LABEL}
          </ThemedText>
        </>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save. Check your connection and try again.
        </ThemedText>
      )}
    </OnboardingQuestion>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
  },
});
