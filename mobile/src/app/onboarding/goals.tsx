import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingAction } from '@/components/onboarding-action';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GOAL_OPTIONS, focusFromGoals, invitesMeasure, type GoalKey } from '@/lib/goals';
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

export default function GoalsScreen() {
  const theme = useTheme();
  const [chosen, setChosen] = useState<GoalKey[]>([]);
  const [measure, setMeasure] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'goals');
    });
  }, []);

  function toggle(key: GoalKey) {
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { fat, muscle } = focusFromGoals(chosen);

    // THE GOAL ROWS ARE REPLACED, NOT MERGED. A multi-select is a set, and
    // somebody coming back through onboarding means the new set, not the union
    // of both. Deleting only her own onboarding rows leaves any goal that
    // arrived through chat alone - those are in her words and were not part of
    // this question.
    const { error: clearError } = await supabase
      .from('user_goals')
      .delete()
      .eq('user_id', user.id)
      .eq('source', 'onboarding');
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
          sort_order: i,
        };
      });
      const { error: insertError } = await supabase.from('user_goals').insert(rows);
      if (insertError) return false;
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

  async function goOn(skipping: boolean) {
    if (saving) return;
    setFailed(false);
    if (skipping) {
      router.push('/onboarding/skill');
      return;
    }
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push('/onboarding/skill');
  }

  useOnboardingAction({
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

          {failed && (
            <ThemedText type="small" themeColor="danger">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}

          <ThemedText type="small" themeColor="textSecondary">
            All of this lives in Plans afterwards, and changes whenever you say so in chat.
          </ThemedText>
        </ScrollView>
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
