import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateCalorieTarget } from '@/lib/calorie-target';
import { resolveTDEE } from '@/lib/body-metrics';
import { displayGoal, goalDate } from '@/lib/goal-display';
import { calculateProteinTarget, proteinTargetLabel } from '@/lib/protein';
import { supabase } from '@/lib/supabase';

// THE GOAL SCREEN (Ruth's design, 29 September 2026).
//
// WHAT IT DRIVES is the point of this screen. A goal on its own is a sentence;
// a goal with the three numbers it produces is an explanation. Until today the
// app held a focus state, computed a calorie target from it, and never showed
// anybody the connection between the thing she said she wanted and the number
// on Today.
//
// THE FIGURES ARE THE REAL ONES, computed here from her profile and her latest
// reading with the same functions the Today screen uses. They are not stored on
// the goal and must not be: a target derived from a weight that changes is a
// number that goes stale the moment it is written down.
//
// HISTORY LIVES ONLY HERE. Her instruction. Plans shows what she is working
// towards now; this screen is where the ones she has moved past are kept,
// because they are a record rather than a list of things to do.
//
// NOTHING IS DELETED. Superseding a goal is a thing that happened, and the
// previous one is how a person reads her own last six months.

type Goal = {
  id: string;
  label: string;
  detail: string | null;
  set_on: string | null;
  archived_at: string | null;
};

// VERBS, NOT PHRASES. The first version stored "Lose fat" here and then
// appended the noun, producing "Lose fat fat, maintain muscle" on the screen -
// caught in the first screenshot. A map of verbs cannot make that mistake,
// which is why it is a map of verbs now rather than a patched string.
const FAT_VERB: Record<string, string> = {
  reduce: 'Lose',
  maintain: 'Maintain',
  increase: 'Gain',
};
const MUSCLE_VERB: Record<string, string> = {
  reduce: 'lose',
  maintain: 'maintain',
  increase: 'build',
};

/** "Lose fat, maintain muscle", from the two focus states. */
function aimLine(fat: string | null, muscle: string | null): string | null {
  const parts: string[] = [];
  if (fat && FAT_VERB[fat]) parts.push(`${FAT_VERB[fat]} fat`);
  if (muscle && MUSCLE_VERB[muscle]) parts.push(`${MUSCLE_VERB[muscle]} muscle`);
  return parts.length > 0 ? parts.join(', ') : null;
}

export default function GoalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [earlier, setEarlier] = useState<Goal[]>([]);
  const [drives, setDrives] = useState<{ aim: string | null; kcal: number | null; protein: string | null } | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: goals }, { data: profile }, { data: latest }] = await Promise.all([
        supabase
          .from('user_goals')
          .select('id, label, detail, set_on, archived_at')
          .order('set_on', { ascending: false }),
        supabase
          .from('user_profile')
          .select('height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, protein_target_g, training_state')
          .maybeSingle(),
        supabase
          .from('body_measurements')
          .select('weight_kg, body_fat_pct, bmr')
          .order('measured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const all = (goals ?? []) as Goal[];
      const chosen = all.find((g) => g.id === id) ?? all.find((g) => !g.archived_at) ?? null;
      setGoal(chosen);
      // EARLIER MEANS ARCHIVED, not "every other goal". Two current goals are
      // both current, and listing one under the other's history would be wrong.
      setEarlier(all.filter((g) => g.archived_at && g.id !== chosen?.id));

      const p = profile as Record<string, unknown> | null;
      const m = latest as { weight_kg: number | null; body_fat_pct: number | null; bmr: number | null } | null;
      // THE SAME ARITHMETIC THE PHONE ALREADY DOES on Today, from the same
      // functions, so this screen cannot quietly show a different number.
      const tdee = resolveTDEE({
        scaleBmr: m?.bmr ?? null,
        weightKg: m?.weight_kg ?? null,
        heightCm: (p?.height_cm as number) ?? null,
        dateOfBirth: (p?.date_of_birth as string) ?? null,
        biologicalSex: (p?.biological_sex as string) ?? null,
        activityLevel: (p?.activity_level as string) ?? null,
      });
      const fat = (p?.fat_focus_state as string) ?? null;
      const muscle = (p?.muscle_focus_state as string) ?? null;
      const calories = calculateCalorieTarget({
        tdeeKcal: tdee?.tdeeKcal ?? null,
        weightKg: m?.weight_kg ?? null,
        fatFocus: fat as never,
        muscleFocus: muscle as never,
      });
      // THE GOAL AND THE BODY FAT, BOTH. This screen passed neither the goal nor
      // a training state until 2 October, so it showed the plain range while the
      // goals screen showed the stepped-up one. See the note in lib/protein.ts.
      const protein = calculateProteinTarget({
        manualG: (p?.protein_target_g as number) ?? null,
        weightKg: m?.weight_kg ?? null,
        bodyFatPct: m?.body_fat_pct ?? null,
        muscleFocus: muscle as never,
        training: (p?.training_state as never) ?? null,
      });
      const label = proteinTargetLabel(protein);

      setDrives({
        aim: aimLine(fat, muscle),
        kcal: calories?.targetKcal ?? null,
        protein: label ? `${label} g` : null,
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* The same back affordance the Settings pages use, inline for the
              same reason it is inline there: four lines, and a component would
              be a second place for it to drift. */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={Spacing.three}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
          </Pressable>
          <ThemedText type="display">Goal</ThemedText>

          {loaded && !goal && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                That goal is no longer here.
              </ThemedText>
            </ThemedView>
          )}

          {goal && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="sectionTitle">{displayGoal(goal.label)}</ThemedText>
              {goalDate(goal.set_on) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Set on {goalDate(goal.set_on)}
                </ThemedText>
              ) : null}
              {goal.detail ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {goal.detail}
                </ThemedText>
              ) : null}

              <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />

              <ThemedText type="smallBold">What it drives</ThemedText>

              {/* A ROW SHOWS WHAT IS SET, and says so plainly when nothing is.
                  A blank beside "Daily energy" would read as zero. */}
              <Drives label="Aim" value={drives?.aim} empty="Not set yet" />
              <Drives
                label="Daily energy"
                value={drives?.kcal != null ? `${drives.kcal.toLocaleString('en-GB')} kcal` : null}
                empty="Needs a goal and a weight"
              />
              <Drives label="Daily protein" value={drives?.protein} empty="Needs a body fat reading" />

              <ThemedText
                type="small"
                themeColor="accentDeep"
                accessibilityRole="link"
                accessibilityLabel="Change goal, opens chat"
                style={styles.change}
                onPress={() =>
                  router.push({
                    pathname: '/',
                    params: {
                      prefill: "I'd like to change what I'm working towards.",
                      askNow: '1',
                    },
                  })
                }>
                Change goal
              </ThemedText>
            </ThemedView>
          )}

          {earlier.length > 0 && (
            <ThemedView style={styles.earlier}>
              <ThemedText type="sectionTitle">Earlier goals</ThemedText>
              {earlier.map((g) => (
                // MUTED, AS THE DESIGN HAS THEM. They are a record, not a
                // choice, and nothing here is tappable because there is nothing
                // to do with a goal you have moved past.
                <ThemedView key={g.id} type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {displayGoal(g.label)}
                  </ThemedText>
                  {goalDate(g.set_on) ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Set on {goalDate(g.set_on)}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              ))}
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Drives({ label, value, empty }: { label: string; value?: string | null; empty: string }) {
  return (
    <View style={styles.driveRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor={value ? 'text' : 'textSecondary'} style={text.driveValue}>
        {value ?? empty}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    // PageInset IS AN OBJECT, not a number - {horizontal, top, bottom}.
    // Passing the object made StyleSheet.create fall back to a union type for
    // EVERY key in the sheet, so the error surfaced a hundred lines away on
    // `styles.container` and said nothing about padding. Worth knowing: one
    // invalid value in a StyleSheet poisons all of them.
    paddingHorizontal: PageInset.horizontal,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.two,
  },
  rule: { height: 1, marginVertical: Spacing.one },
  driveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  change: { marginTop: Spacing.two },
  earlier: { gap: Spacing.two, marginTop: Spacing.three },
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});

// TEXT STYLES, SEPARATELY. StyleSheet.create infers one union type across every
// entry, so a single TextStyle in the sheet above would make `styles.container`
// unassignable to a View. Two sheets rather than a cast, because a cast would
// have hidden the next real mismatch.
const text = StyleSheet.create({
  // Wraps rather than clipping. "Lose fat, maintain muscle" is longer than it
  // looks at a big font size.
  driveValue: { flexShrink: 1, textAlign: 'right' },
});
