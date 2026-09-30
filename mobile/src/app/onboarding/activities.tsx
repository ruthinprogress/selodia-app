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
import { supabase } from '@/lib/supabase';

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'activity_tdee');
    });
  }, []);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    // Only the rows onboarding put there are replaced. Anything added later in
    // chat is hers and is not this screen's to remove.
    const { error: clearError } = await supabase.from('user_week').delete().eq('user_id', user.id);
    if (clearError) return false;
    if (chosen.length === 0) return true;

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

    const rows = chosen.map((key, i) => ({
      user_id: user.id,
      activity: ACTIVITIES.find((a) => a.key === key)!.label,
      // NO PURPOSE LINE YET, and that is honest rather than lazy. The purpose
      // is why a thing is in her week, and nothing on this screen has asked
      // her. Chat fills it in once there is a conversation to fill it from;
      // inventing "cardio and bone density" for somebody who said "swimming"
      // would be the app putting words in her mouth on day one.
      purpose: null,
      cadence: cadences[key] ? CADENCE_WORDS[cadences[key]!] : null,
      sort_order: i,
    }));
    const { error } = await supabase.from('user_week').insert(rows);
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
    enabled: !saving,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip for now', onPress: () => void goOn(true) },
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
