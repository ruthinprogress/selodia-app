import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingAction } from '@/components/onboarding-action';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WeightQuestion, type WeightAnswer } from '@/components/weight-question';
import { explainTarget, intentFromFocus, type TargetWorking } from '@/lib/body-intent';
import { resolveTDEE } from '@/lib/body-metrics';
import { GOAL_OPTIONS, focusFromGoals, invitesMeasure, type GoalKey } from '@/lib/goals';
import { calculateProteinTarget } from '@/lib/protein';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
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
  // WHAT SHE IS SHOWN BEFORE ANYTHING IS WRITTEN. Ruth: "Show her the figures
  // and how they were worked out before saving." Non-null means the working is
  // on screen and the next press is the one that saves.
  const [working, setWorking] = useState<TargetWorking | null>(null);
  // Her height, age, sex and activity level, for the arithmetic in the preview.
  // Read once; this screen does not change any of them.
  const [body, setBody] = useState<{
    heightCm: number | null;
    dateOfBirth: string | null;
    biologicalSex: string | null;
    activityLevel: string | null;
    scaleBmr: number | null;
    storedWeightKg: number | null;
    storedWeightSource: 'estimate' | 'measured' | null;
  } | null>(null);

  // FROM TODAY, OR FROM SETUP. Ruth: "The 'set your goals' link from Today
  // opens the goals screen only, then returns to Today." Walking her into the
  // rest of the setup chain after one tap from Today would be the trap of
  // 1 October in a politer form.
  const params = useLocalSearchParams<{ redo?: string }>();
  const cameFromToday = params.redo === '1';

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
      if (!cameFromToday) advanceOnboardingStep(supabase, user.id, 'goals');

      const [{ data: profile }, { data: current }, { data: goalRows }] = await Promise.all([
        supabase
          .from('user_profile')
          .select('height_cm, date_of_birth, biological_sex, activity_level')
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
        supabase
          .from('user_goals')
          .select('goal_key, detail')
          .eq('user_id', user.id)
          .eq('source', 'onboarding')
          .is('archived_at', null),
      ]);
      const { data: measured } = await supabase
        .from('body_measurements')
        .select('bmr')
        .not('bmr', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(1);
      if (!live) return;

      setBody({
        heightCm: typeof profile?.height_cm === 'number' ? profile.height_cm : null,
        dateOfBirth: (profile?.date_of_birth as string) ?? null,
        biologicalSex: (profile?.biological_sex as string) ?? null,
        activityLevel: (profile?.activity_level as string) ?? null,
        scaleBmr: Number(measured?.[0]?.bmr) || null,
        storedWeightKg: Number(current?.weight_kg) || null,
        storedWeightSource: (current?.weight_source as 'estimate' | 'measured') ?? null,
      });

      const keys = (goalRows ?? [])
        .map((r) => r.goal_key as GoalKey)
        .filter((k) => GOAL_OPTIONS.some((o) => o.key === k));
      if (keys.length > 0) setChosen(keys);
      const detail = (goalRows ?? []).find((r) => typeof r.detail === 'string' && r.detail)?.detail;
      if (typeof detail === 'string') setMeasure(detail);
    })();
    return () => {
      live = false;
    };
  }, [cameFromToday]);

  function toggle(key: GoalKey) {
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    // See the render: figures she has read must not be the figures that save
    // after she changed the goal they were worked out from.
    setWorking(null);
  }

  /**
   * The figures and how they were reached, for showing her before saving.
   *
   * NOTHING IS WRITTEN BY THIS. It is the same arithmetic the app will use, run
   * on the answers currently on screen, so what she approves is what gets saved.
   * Her instruction: "Show her the figures and how they were worked out before
   * saving."
   *
   * NULL MEANS THERE IS NOTHING WORTH SHOWING - no body goal chosen, or she said
   * she does not know her weight. A preview that says "no target" is a step for
   * nothing, so Continue just saves in that case and Today carries the one line
   * about what is missing.
   */
  function computeWorking(): TargetWorking | null {
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
    const protein = calculateProteinTarget(null, weightKg, null, intent.highProtein);

    return explainTarget({
      intent,
      weightKg,
      weightSource,
      bmrKcal: tdee?.bmrKcal ?? null,
      tdeeKcal: tdee?.tdeeKcal ?? null,
      activityWord: ACTIVITY_WORD[body?.activityLevel ?? ''] ?? null,
      proteinLow: protein?.kind === 'range' ? protein.low : null,
      proteinHigh: protein?.kind === 'range' ? protein.high : null,
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
    const archivedAt = new Date().toISOString();
    const { error: clearError } = await supabase
      .from('user_goals')
      .update({ archived_at: archivedAt })
      .eq('user_id', user.id)
      .eq('source', 'onboarding')
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

    // NULL IS WRITTEN DELIBERATELY when nothing was chosen. It is not a missing
    // update - it is the app saying it does not know, which is now a state the
    // target code understands and the column allows.
    const { error: profileError } = await supabase
      .from('user_profile')
      .update({ fat_focus_state: fat, muscle_focus_state: muscle })
      .eq('user_id', user.id);
    return !profileError;
  }

  /** Where Continue goes once this screen is done with her. */
  function leave() {
    // BACK TO TODAY WHEN SHE CAME FROM TODAY. Her instruction for item 3, and the
    // fix for the trap she hit on 1 October: tapping a link on Today used to drop
    // her into the setup chain with no way back to the screen she started on.
    if (cameFromToday) router.replace('/');
    else router.push('/onboarding/skill');
  }

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      leave();
      return;
    }

    // THE FIGURES COME BEFORE THE WRITE, ONCE. First press works them out and
    // shows them; the second press saves what she has just read. When there is
    // nothing to show - no body goal, or no weight - it saves straight away,
    // because a preview of "no target" is a step that asks her to approve
    // nothing.
    if (working == null) {
      const next = computeWorking();
      if (next) {
        setWorking(next);
        return;
      }
    }

    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    leave();
  }

  useOnboardingAction({
    // THE LABEL SAYS WHICH PRESS THIS IS. "Continue" twice would look like the
    // first press had not registered, which is exactly how a confirm step gets
    // read as a bug.
    label: saving ? 'Saving…' : working ? 'Save this' : 'Continue',
    // ENABLED EVEN WITH NOTHING CHOSEN. Nothing here is required, and a
    // Continue that waits for an answer would make an optional question feel
    // compulsory. Choosing nothing is a real answer: both focuses stay unset
    // and no calorie target is invented.
    enabled: !saving,
    onPress: () => void goOn(false),
    secondary: { label: 'Skip this question', onPress: () => void goOn(true) },
  });

  const showMeasure = invitesMeasure(chosen);

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
            onChange={(next) => {
              setWeight(next);
              // THE WORKING IS DROPPED WHEN AN INPUT CHANGES. Figures she has
              // already read must never be the figures that get saved after she
              // changed the weight underneath them.
              setWorking(null);
            }}
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
                Nothing is saved until you tap Save this.
              </ThemedText>
            </ThemedView>
          )}

          {failed && (
            <ThemedText type="small" themeColor="danger">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}

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
  measureCard: {
    padding: Spacing.four,
    borderRadius: ButtonRadius,
    gap: Spacing.three,
  },
  measureInput: {
    borderWidth: 1,
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  pressed: { opacity: 0.7 },
});
