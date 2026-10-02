import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingAction } from '@/components/onboarding-action';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WeightQuestion, type WeightAnswer } from '@/components/weight-question';
import { explainTarget, intentFromFocus, type TargetWorking } from '@/lib/body-intent';
import { resolveTDEE } from '@/lib/body-metrics';
import { GOAL_OPTIONS, focusFromGoals, invitesMeasure, type GoalKey } from '@/lib/goals';
import { calculateProteinTarget } from '@/lib/protein';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { useOneQuestion } from '@/lib/one-question';
import { supabase } from '@/lib/supabase';

// WHAT BRINGS HER HERE. Taps, not a conversation (Ruth's session brief,
// 28 September 2026).
//
// WHAT THIS REPLACED, AND WHY IT HAD TO GO. This screen used to open with
// "Let's talk about what you're hoping to get out of this" and wait for her to
// type. The words "fat_focus_state" and "muscle_focus_state" appeared in it
// exactly zero times: a goal became a target only if the chat model happened to
// infer a focus change from her prose AND she then confirmed it. Nothing
// guaranteed either step. Meanwhile the columns were NOT NULL DEFAULT
// 'maintain', so the outcome of saying something thoughtful and the outcome of
// saying nothing were identical - a maintenance target, presented as hers.
// Every account in the database was in that state, Ruth's included.
//
// A tap writes the column. That is the whole change, and it is why the brief
// says every answer must change something.
//
// SCREENS ARE IMPERSONAL. Only chat says "I". Nothing here does.
//
// NO SHAME ANYWHERE. Every option is phrased as something to move towards,
// none of them carries a number, and the optional measure below is shown as one
// line and never counted down from.

const QUESTION = 'What brings you here?';
const SUBTITLE = 'Pick as many as fit. Each one changes what Selodía works out for you.';

// Ruth's own wording, from the brief.
const MEASURE_PROMPT = 'Got a number or measure in mind? Weight, waist, anything.';
const MEASURE_NOTE = 'Optional. It sits under your goals as a reminder of what you said, and is never counted down from.';

// HOW ACTIVE SHE SAID SHE IS, in words, for the line that explains the figure.
// The stored values are the TDEE multiplier's own vocabulary; "with your days
// being moderate" is not a sentence, so each one gets a phrase she would
// recognise as a description of her week.
const ACTIVITY_WORD: Record<string, string> = {
  sedentary: 'mostly still',
  light: 'lightly active',
  moderate: 'moderately active',
  active: 'active most days',
  very_active: 'very active',
};

export default function GoalsScreen() {
  const theme = useTheme();
  const [chosen, setChosen] = useState<GoalKey[]>([]);
  const [measure, setMeasure] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [weight, setWeight] = useState<WeightAnswer | null>(null);
  /** Goals she already has that no chip can represent. Shown, not hidden. */
  const [existing, setExisting] = useState<string[]>([]);
  // The figures are DERIVED, not stored: see computeWorking. Holding them in
  // state is what let them go stale against the answers on screen, and what
  // made a second press necessary to reconcile them.
  // Her height, age, sex and activity level, for the arithmetic in the preview.
  // Read once; this screen does not change any of them.
  const [body, setBody] = useState<{
    heightCm: number | null;
    dateOfBirth: string | null;
    biologicalSex: string | null;
    activityLevel: string | null;
    scaleBmr: number | null;
    // HER BODY FAT, WHICH THIS SCREEN DID NOT READ. Without it the protein sum
    // fell to the bodyweight path while every other surface used the lean-mass
    // one, and the two figures Ruth photographed a minute apart were 20 g apart.
    bodyFatPct: number | null;
    trainingState: 'training' | 'paused' | null;
    deficitState: 'on' | 'paused' | null;
    storedWeightKg: number | null;
    storedWeightSource: 'estimate' | 'measured' | null;
  } | null>(null);

  // FROM TODAY, OR FROM SETUP. Ruth: "The 'set your goals' link from Today
  // opens the goals screen only, then returns to Today." Walking her into the
  // rest of the setup chain after one tap from Today would be the trap of
  // 1 October in a politer form.
  // THE SAME HELPER AS EVERY OTHER ROW NOW. This screen had its own copy of
  // this logic, which is precisely why the other eleven rows of the Body Manual
  // never got it: a fix written as three lines inside one file protects one file.
  const { fromManual, leave } = useOneQuestion();

  useEffect(() => {
    let live = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // A REDO FROM TODAY IS NOT A STEP OF SETUP. Advancing the stored step
      // would move her setup position because she tapped a link on Today, which
      // is how she ended up pinned to the goals screen on 1 October.
      if (!fromManual) advanceOnboardingStep(supabase, user.id, 'goals');

      const [{ data: profile }, { data: current }, { data: goalRows }] = await Promise.all([
        supabase
          .from('user_profile')
          .select('height_cm, date_of_birth, biological_sex, activity_level, training_state, deficit_state')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('current_weight')
          .select('weight_kg, weight_source')
          .eq('user_id', user.id)
          .maybeSingle(),
        // ITEM 4: A REDO SHOWS WHAT SHE ALREADY CHOSE. Her own onboarding rows,
        // so a goal added in chat is not shown as a chip this screen could
        // then overwrite.
        // SAME SCOPING FAULT, SAME FIX. Reading only onboarding rows meant a
        // woman whose goals came from chat opened this screen with nothing
        // selected and no sign that she had any goals at all - and then her
        // answer replaced something the screen had never shown her.
        supabase
          .from('user_goals')
          .select('goal_key, detail, label')
          .eq('user_id', user.id)
          .is('archived_at', null),
      ]);
      const { data: measured } = await supabase
        .from('body_measurements')
        .select('bmr')
        .not('bmr', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(1);
      // READ SEPARATELY FROM THE BMR ROW ON PURPOSE. The latest row with a BMR
      // and the latest row with a body fat reading are not always the same row,
      // and taking body fat from the BMR row would silently use a stale figure
      // or none at all.
      const { data: fatRow } = await supabase
        .from('body_measurements')
        .select('body_fat_pct')
        .not('body_fat_pct', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(1);
      if (!live) return;

      setBody({
        heightCm: typeof profile?.height_cm === 'number' ? profile.height_cm : null,
        dateOfBirth: (profile?.date_of_birth as string) ?? null,
        biologicalSex: (profile?.biological_sex as string) ?? null,
        activityLevel: (profile?.activity_level as string) ?? null,
        scaleBmr: Number(measured?.[0]?.bmr) || null,
        bodyFatPct: Number(fatRow?.[0]?.body_fat_pct) || null,
        trainingState: (profile?.training_state as 'training' | 'paused') ?? null,
        deficitState: (profile?.deficit_state as 'on' | 'paused') ?? null,
        storedWeightKg: Number(current?.weight_kg) || null,
        storedWeightSource: (current?.weight_source as 'estimate' | 'measured') ?? null,
      });

      const keys = (goalRows ?? [])
        .map((r) => r.goal_key as GoalKey)
        .filter((k) => GOAL_OPTIONS.some((o) => o.key === k));
      if (keys.length > 0) setChosen(keys);
      // A GOAL IN HER OWN WORDS HAS NO CHIP TO LIGHT UP. Hers reads "Reach 25%
      // body fat and 40 kg muscle mass", which no tap can represent. Saying so is
      // the difference between a screen that looks blank and a screen that tells
      // her what it is about to replace.
      setExisting(
        (goalRows ?? [])
          .filter((r) => !GOAL_OPTIONS.some((o) => o.key === r.goal_key))
          .map((r) => String(r.label ?? ''))
          .filter(Boolean)
      );
      const detail = (goalRows ?? []).find((r) => typeof r.detail === 'string' && r.detail)?.detail;
      if (typeof detail === 'string') setMeasure(detail);
    })();
    return () => {
      live = false;
    };
  }, [fromManual]);

  function toggle(key: GoalKey) {
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  /**
   * The figures and how they were reached, shown live as she answers.
   *
   * THIS COST RUTH HER GOAL (2 October 2026, and it was my bug, made today).
   *
   * Her instruction was "show her the figures and how they were worked out before
   * saving". I implemented that as a CONFIRM STEP: the first press of Continue
   * computed the figures, set them in state, and RETURNED WITHOUT WRITING
   * ANYTHING. A second press on the header button - relabelled from "Continue" to
   * "Save this" - was what actually saved.
   *
   * She went through onboarding, chose her goal, typed "45 kg muscle", pressed
   * Continue, and nothing was written. The panel that would have explained the
   * second press renders below the goal options, the weight question AND the
   * measure box, on a screen 1280px tall - so on a phone it was below the fold.
   * She saw nothing change and moved on. Her goal was lost and her old one was
   * never archived.
   *
   * THIS IS THE BUG I DIAGNOSED THAT MORNING AND THEN REBUILT. Splits did not save
   * because a second required interaction rendered below the fold while the screen
   * implied success. I wrote that up, committed it, and hours later gated a WRITE
   * on the identical pattern.
   *
   * SO THE WRITE IS NEVER GATED ON A SECOND PRESS. Continue saves, once, as it
   * always did. The figures are satisfied differently and better: they are on
   * screen the whole time, updating as she taps, so by the time she presses
   * anything she has already seen them. "Before saving" is a fact about what is
   * visible, not a reason to add a gate.
   *
   * NULL MEANS THERE IS NOTHING WORTH SHOWING - no body goal chosen, or she said
   * she does not know her weight.
   */
  function computeWorking(): TargetWorking | null {
    // Recomputed on every render from whatever is currently selected. See the
    // note on `working` below for why this is no longer called on a press.
    const { fat, muscle } = focusFromGoals(chosen);
    const intent = intentFromFocus(fat, muscle);
    if (!intent) return null;

    // HER ANSWER FIRST, THEN WHAT IS ALREADY STORED. She may be re-running this
    // with the box empty, and the weight from her scale is still true.
    const weightKg = weight?.known === true ? weight.kg : (body?.storedWeightKg ?? null);
    const weightSource =
      weight?.known === true ? 'estimate' : (body?.storedWeightSource ?? null);
    if (weight?.known === false) return null;
    if (weightKg == null) return null;

    const tdee = resolveTDEE({
      scaleBmr: body?.scaleBmr ?? null,
      weightKg,
      heightCm: body?.heightCm ?? null,
      dateOfBirth: body?.dateOfBirth ?? null,
      biologicalSex: body?.biologicalSex ?? null,
      activityLevel: body?.activityLevel ?? null,
    });
    const protein = calculateProteinTarget({
      weightKg,
      bodyFatPct: body?.bodyFatPct ?? null,
      muscleFocus: intent.muscle,
      training: body?.trainingState ?? null,
    });

    return explainTarget({
      intent,
      weightKg,
      weightSource,
      bmrKcal: tdee?.bmrKcal ?? null,
      tdeeKcal: tdee?.tdeeKcal ?? null,
      activityWord: ACTIVITY_WORD[body?.activityLevel ?? ''] ?? null,
      proteinLow: protein?.kind === 'range' ? protein.low : null,
      proteinHigh: protein?.kind === 'range' ? protein.high : null,
      proteinStepped: protein?.kind === 'range' ? protein.stepped : null,
      deficitPaused: body?.deficitState === 'paused',
    });
  }

  async function save(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { fat, muscle } = focusFromGoals(chosen);

    // THE GOAL ROWS ARE REPLACED, NOT MERGED. A multi-select is a set, and
    // somebody coming back through onboarding means the new set, not the union
    // of both. Touching only her own onboarding rows leaves any goal that
    // arrived through chat alone - those are in her words and were not part of
    // this question.
    //
    // ARCHIVED RATHER THAN DELETED (2 October 2026). Ruth, item 4: "GOALS keep a
    // history: each goal dated; when updated the old becomes a card in Almanac
    // under the Goals tag." A delete made that impossible - the previous goal was
    // simply gone, so there was nothing to date and nothing to look back at. The
    // row stays, stamped, and stops being current.
    //
    // Plans and the first draft read `archived_at is null`, so an archived goal
    // leaves them immediately and only the current one is ever shown.
    // IT ONLY ARCHIVED ITS OWN ROWS, AND HERS CAME FROM CHAT (2 October 2026).
    //
    // Ruth: "I went through the onboarding and purposefully selected 45KG muscle
    // only... it should have replaced my old one and added my old goal to almanac
    // as under Goal History tag." It did not, and this is why: the filter was
    // `source = 'onboarding'`, and BOTH her goals are `source = 'chat'`. So her
    // September goal was never going to be archived by this screen, whatever she
    // chose - she would have ended up with two active goals and the old one still
    // showing in Plans.
    //
    // THE ORIGINAL SCOPING WAS RIGHT FOR A WIZARD AND IS WRONG FOR THIS. Its
    // reasoning was sound: "anything that arrived through chat is in her words and
    // was not part of this question", which is true of a setup flow replaying its
    // own answers. It is not true now. This screen is reached from one place - the
    // Body Manual's "Your body goal" row, which shows EVERY active goal - and
    // "Change this" means change what is shown. Leaving a goal she can see on that
    // row unarchived is the screen ignoring half of what it displayed.
    //
    // NOTHING IS LOST BY WIDENING IT. An archived goal keeps its row, keeps its
    // dates, and the goal_archived_to_almanac trigger writes it to her Almanac
    // under the Goals tag - which is exactly the behaviour she described wanting.
    // NOTHING CHOSEN CHANGES NOTHING (2 October 2026, 19:10).
    //
    // IT WIPED HER GOAL AN HOUR AFTER I WIDENED THE SCOPE. At 18:56:19 the archive
    // ran, "Reach 25% body fat and 40 kg muscle mass" was archived, and NO row was
    // inserted - because the archive was unconditional while the insert sat behind
    // `chosen.length > 0`. Her Body Manual read "none yet" a minute later. She
    // saved again at 18:57:23 and that worked, so the damage lasted one minute and
    // was entirely visible to her, which is the only reason it is not worse.
    //
    // THIS IS THE WEEK WIPE OF 1 OCTOBER, EXACTLY: a destructive operation running
    // before anything checks whether there is something to replace. I diagnosed
    // that one, built check-week-write-plan.mjs around it, and restated it in two
    // commit messages - then widened this archive from `source = 'onboarding'` to
    // every active goal without carrying the guard across. Widening a delete is
    // precisely when that guard matters most.
    //
    // THE ARCHIVE AND THE INSERT ARE NOW ONE DECISION. Either she chose a goal, in
    // which case the old ones are archived and the new ones written, or she did
    // not, in which case neither happens. There is no arrangement of taps that
    // removes a goal without putting one in its place.
    if (chosen.length > 0) {
      const archivedAt = new Date().toISOString();
      const { error: clearError } = await supabase
        .from('user_goals')
        .update({ archived_at: archivedAt })
        .eq('user_id', user.id)
        .is('archived_at', null);
      if (clearError) return false;

      if (chosen.length > 0) {
        const detail = measure.trim() || null;
        const rows = chosen.map((key, i) => {
          const option = GOAL_OPTIONS.find((o) => o.key === key)!;
          return {
            user_id: user.id,
            goal_key: key,
            label: option.label,
            // The measure belongs to the goal that invited it, not to all of
            // them: "12 stone" under "more energy" would be nonsense.
            detail: option.invitesMeasure ? detail : null,
            source: 'onboarding',
            // DATED, because item 4 asks for a history and a history needs dates.
            set_on: new Date().toISOString().slice(0, 10),
            sort_order: i,
          };
        });
        const { error: insertError } = await supabase.from('user_goals').insert(rows);
        if (insertError) return false;
      }
    }

    // HER WEIGHT, AS AN ESTIMATE WITH A DATE ON IT.
    //
    // A NEW ROW, NEVER AN EDIT. Ruth: "store weight with a source (estimate or
    // measured) and a date; the latest real weigh-in wins; the first real
    // weigh-in replaces an estimate and keeps history." A row per answer is what
    // makes all three true at once - the view `current_weight` prefers a measured
    // reading over any estimate, and nothing is ever overwritten.
    //
    // ONLY WHEN SHE GAVE ONE. "I do not know yet" writes nothing, which is the
    // difference between it and a guess: there is no number to keep.
    if (weight?.known === true) {
      const { error: weightError } = await supabase.from('body_measurements').insert({
        user_id: user.id,
        weight_kg: weight.kg,
        weight_source: 'estimate',
        measured_at: new Date().toISOString(),
        notes: 'Given on the goals screen. A guess, not a weigh-in.',
      });
      if (weightError) return false;
    }

    // AND THE SAME GUARD ON THE FOCUS, which is the other half of the wipe.
    //
    // This used to write NULL deliberately when nothing was chosen, and that was
    // right when this screen was a wizard step: an unanswered question meant "she
    // has not said", and the target code reads null as no target rather than a
    // maintenance one. Reached from the Body Manual by somebody who opened the row
    // and tapped nothing, the same line erases the targets she already had.
    //
    // Choosing nothing is still a real answer on the FIRST run - the focus has
    // never been set, so writing null changes nothing and the honest outcome is
    // unchanged. What it must not do is overwrite.
    if (chosen.length === 0) return true;

    const { error: profileError } = await supabase
      .from('user_profile')
      .update({ fat_focus_state: fat, muscle_focus_state: muscle })
      .eq('user_id', user.id);
    return !profileError;
  }

  /** Where Continue goes once this screen is done with her. */
  function onDone() {
    // BACK WHERE SHE CAME FROM, WHICH IS THE BODY MANUAL (2 October 2026).
    //
    // Ruth: "it took me to the chat page after, which is not correct. It should
    // take me back to the goal setting section of the Profile page so I can see my
    // new goal."
    //
    // `router.replace('/')` was written when this screen was reached from Today,
    // and '/' is the chat tab. Every route into it now comes from the Body
    // Manual's own row, so that is where it returns - and seeing the new goal on
    // the row she tapped is the confirmation that the save happened, which no
    // sentence can replace.
    leave('/onboarding/skill');
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      onDone();
      return;
    }

    // NO GATE. One press, one save, as it was before I broke it this afternoon.
    // The figures are already on screen - see the note on computeWorking.
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    onDone();
  }

  useOnboardingAction({
    // ONE LABEL, BECAUSE THERE IS ONE PRESS. It said "Save this" after a first
    // press that had saved nothing, which is a button describing a state she had
    // no way to know she was in.
    label: saving ? 'Saving…' : 'Continue',
    // ENABLED EVEN WITH NOTHING CHOSEN. Nothing here is required, and a
    // Continue that waits for an answer would make an optional question feel
    // compulsory. Choosing nothing is a real answer: both focuses stay unset
    // and no calorie target is invented.
    enabled: !saving,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  const showMeasure = invitesMeasure(chosen);
  // THE FIGURES, RECOMPUTED EVERY RENDER from whatever is selected right now.
  // Derived rather than stored, so they cannot disagree with the answers above
  // them - which is what made a second press look necessary.
  const working = computeWorking();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          // Room for the next thing below the field, so it never sits
          // flush against the top of the keyboard.
          bottomOffset={24}>
          <ThemedText type="sectionTitle">{QUESTION}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {SUBTITLE}
          </ThemedText>

          {/* WHAT SHE ALREADY HAS, when no chip can show it. Her goal reads
              "Reach 25% body fat and 40 kg muscle mass" and no tap represents
              that, so without this line the screen looks like she has never set
              one - and then quietly replaces it. */}
          {existing.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.measureCard}>
              <ThemedText type="small" themeColor="textSecondary">
                What you have now
              </ThemedText>
              {existing.map((label) => (
                <ThemedText key={label} type="small">
                  {label}
                </ThemedText>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Choosing below replaces this. The old one is kept, dated, in your Almanac.
              </ThemedText>
            </ThemedView>
          )}

          <View style={styles.options}>
            {GOAL_OPTIONS.map((option) => {
              const on = chosen.includes(option.key);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggle(option.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={option.label}
                  style={({ pressed }) => [styles.optionWrap, pressed && styles.pressed]}>
                  <ThemedView
                    type={on ? 'backgroundSelected' : 'backgroundElement'}
                    style={[
                      styles.option,
                      { borderColor: on ? theme.accentDeep : 'transparent' },
                    ]}>
                    <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                      {option.label}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>

          {showMeasure && (
            <ThemedView type="backgroundElement" style={styles.measureCard}>
              <ThemedText type="small">{MEASURE_PROMPT}</ThemedText>
              <TextInput
                value={measure}
                onChangeText={setMeasure}
                placeholder="Nothing in mind is fine too"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel={MEASURE_PROMPT}
                style={[
                  styles.measureInput,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {MEASURE_NOTE}
              </ThemedText>
            </ThemedView>
          )}

          {/* ROUGHLY WHAT DO YOU WEIGH? Asked here because this is the screen
              whose answers need it: "lose fat" is half a percent of bodyweight a
              week, which is not a figure at all without a bodyweight. Before
              today the goal saved and the target stayed blank, with nothing on
              any screen saying why. */}
          <WeightQuestion
            value={weight}
            // Nothing to invalidate: the figures below recompute from this.
            onChange={setWeight}
          />

          {/* THE FIGURES, AND HOW THEY WERE REACHED, BEFORE ANYTHING IS SAVED.
              Ruth's instruction for item 3.

              WHY IT IS WORTH A WHOLE STEP. A number with no visible basis is
              something to be obeyed or failed; a number she watched being built
              is a tool she can argue with. It also catches a wrong input faster
              than any validation would: a weight typed in pounds into the kg box
              shows up here as an absurd BMR, and she will see that immediately.

              NO TARGET WEIGHT AND NO DATE appear in any of these lines. */}
          {working && (
            <ThemedView type="backgroundElement" style={styles.measureCard}>
              <ThemedText type="small">How that works out</ThemedText>
              {working.lines.map((line, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary">
                  {line}
                </ThemedText>
              ))}
              {working.missing && (
                <ThemedText type="small" themeColor="accentDeep">
                  {working.missing}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Saved when you tap Continue.
              </ThemedText>
            </ThemedView>
          )}

          {failed && (
            <ThemedText type="small" themeColor="danger">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}

          {/* A SAVE WHERE SHE FINISHES READING (2 October 2026).
              The forward action lives in the header, at the top. That is fine on a
              short screen and wrong on this one: goals, then the measure, then the
              weight question, then a panel explaining her targets that ends
              "Saved when you tap Continue" - with no Continue anywhere near it.
              Ruth read to the bottom of exactly that and her goal was not saved.
              The header button stays; this is the same action, where the sentence
              that mentions it is. */}
          <Pressable
            onPress={() => void goOn(false)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving' : 'Continue'}
            accessibilityState={{ disabled: saving }}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type={saving ? 'backgroundElement' : 'backgroundSelected'}
              style={styles.bottomAction}>
              <ThemedText type="smallBold" themeColor={saving ? 'textSecondary' : 'accentDeep'}>
                {saving ? 'Saving…' : 'Continue'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary">
            All of this lives in Plans afterwards, and changes whenever you say so in chat.
          </ThemedText>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.four,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionWrap: {
    // A wrapper rather than a style on the card, so the whole tappable area
    // moves together when pressed.
    borderRadius: ButtonRadius,
  },
  option: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: ButtonRadius,
    borderWidth: 1,
  },
  // CardRadius, NOT ButtonRadius. ButtonRadius is 999, which is how you make a
  // pill out of something one line tall and how you make a BLOB out of anything
  // taller: the corners round until they meet and the card becomes an ellipse.
  // Ruth's screenshots of 2 October show it on the weight question and on the
  // panel that explains her targets - two enormous ovals with text inside them.
  //
  // It was invisible to me because I never loaded the screen. A 999 radius reads
  // as "fully rounded" in source and says nothing about the shape it makes.
  measureCard: {
    padding: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.three,
  },
  measureInput: {
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  bottomAction: {
    paddingVertical: Spacing.three,
    borderRadius: ButtonRadius,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
