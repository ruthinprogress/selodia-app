import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanExerciseView, PlanView } from '@/lib/almanac-content';
import { authedPost } from '@/lib/api';
import { estimateMinutes } from '@/lib/movement-library';
import { exerciseMetaLine, groupPlanExercises, shouldGroup } from '@/lib/workout-plan';

// A saved practice, open (Ruth's brief and mockup, 2026-09-18).
//
// THE TICKS ARE THE SESSION, AND THE SESSION IS NOT THE RECORD. This is the
// behaviour change in the brief, and it reverses what was here: a tick used to
// write a completion row the moment it was pressed, which meant a routine opened
// out of curiosity and half-ticked became a half-finished workout in the
// Activity log, and a tick could never be undone. Now ticks live only while the
// sheet is open. Nothing is written until she says so at the end, and closing
// without saving writes nothing at all.
//
// WHAT DOES SURVIVE IS THE WORKING WEIGHT. That is a fact about the movement -
// what she lifts - and it is saved when she sets it, whether or not the session
// is logged. Tomorrow the routine opens unticked, with the weights remembered.
//
// NOTHING CELEBRATES. No confetti, no trophies, no streak. The completed footer
// asks a plain question and offers two plain answers, and "Not now" is a real
// answer rather than a way of nagging.

export function WorkoutPlanView({
  planId,
  planTitle,
  plan,
  onOpenExercise,
  weights,
}: {
  planId: string;
  planTitle: string;
  plan: PlanView;
  onOpenExercise: (exercise: PlanExerciseView) => void;
  weights: Map<string, number>;
}) {
  const groups = groupPlanExercises(plan);
  const showGroupInline = !shouldGroup(plan.programType);
  const minutes = estimateMinutes(plan);

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const total = plan.exercises.length;
  const completed = plan.exercises.filter((x) => done[x.name]).length;
  const allDone = total > 0 && completed === total;

  function toggle(x: PlanExerciseView) {
    // Untickable, because a tick is now a note to herself about this session
    // rather than a row in a log. Mis-tapping one used to be permanent.
    setDone((d) => ({ ...d, [x.name]: !d[x.name] }));
    setSaved(false);
    setFailed(false);
  }

  async function saveToActivity() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      // One post per completed exercise. The route is what keeps the session's
      // single activity_logs row in step - rolling eccentric load up as the
      // highest across the session, so the DOMS flag sees the hardest work -
      // and a direct insert from here would skip that silently.
      for (const x of plan.exercises) {
        if (!done[x.name]) continue;
        await authedPost('/api/log-workout-completion', {
          planId,
          planTitle,
          exerciseName: x.name,
          eccentricLoad: null,
          intensity: null,
        });
      }
      setSaved(true);
    } catch {
      // Say so rather than showing a tick that means nothing. A session she
      // believes is logged and is not is worse than one she knows failed.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {plan.goal && (
        <ThemedText type="small" themeColor="textSecondary">
          {plan.goal}
        </ThemedText>
      )}

      {minutes != null && (
        <ThemedText type="small" themeColor="textSecondary">
          Approximately {minutes} minutes
        </ThemedText>
      )}

      {groups.map((g, gi) => (
        <View key={g.heading ?? `__ungrouped-${gi}`} style={styles.group}>
          {g.heading && (
            // The body region as a heading of its own, in the serif, with real
            // space above it: the brief asks for sections rather than a list
            // with labels in it.
            <ThemedText type="sectionTitle" style={styles.heading}>
              {g.heading}
            </ThemedText>
          )}
          {g.exercises.map((x, i) => (
            <ExerciseRow
              key={`${x.name}-${i}`}
              exercise={x}
              showGroup={showGroupInline}
              done={done[x.name] === true}
              workingWeightKg={weights.get(x.name) ?? null}
              onToggle={() => toggle(x)}
              onOpen={() => onOpenExercise(x)}
            />
          ))}
        </View>
      ))}

      {/* THE FOOTER ARRIVES ONLY WHEN THE WORK IS DONE, and asks rather than
          announces. Saving is a choice: a practice done for its own sake is not
          less done for going unrecorded. */}
      {allDone && !saved && (
        <ThemedView type="backgroundElement" style={styles.footer}>
          <ThemedText type="small">Ready to save today&apos;s movement?</ThemedText>
          <View style={styles.footerActions}>
            <Pressable
              onPress={() => void saveToActivity()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save to Activity"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="accentDeep" style={styles.primary}>
                <ThemedText type="smallBold" themeColor="background">
                  {saving ? 'Saving…' : 'Save to Activity'}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => setDone({})}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="textSecondary" style={styles.quiet}>
                Not now
              </ThemedText>
            </Pressable>
          </View>
          {failed && (
            <ThemedText type="small" themeColor="textSecondary">
              That didn&apos;t save. Try again in a moment.
            </ThemedText>
          )}
        </ThemedView>
      )}

      {saved && (
        <ThemedView type="backgroundElement" style={styles.footer}>
          <ThemedText type="small">
            Saved to today&apos;s Activity. Your working weights are kept for next time.
          </ThemedText>
        </ThemedView>
      )}
    </View>
  );
}

function ExerciseRow({
  exercise,
  showGroup,
  done,
  workingWeightKg,
  onToggle,
  onOpen,
}: {
  exercise: PlanExerciseView;
  showGroup: boolean;
  done: boolean;
  workingWeightKg: number | null;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  // The weight has its own line on the card, so it is left out of the meta.
  const meta = exerciseMetaLine(exercise, null, showGroup);

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `${exercise.name}, done` : exercise.name}
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {/* Drawn here rather than through components/checkbox.tsx: that one is a
            box AND its label as one control, which is right for a question in a
            sheet and wrong for a card that already carries the name, the sets
            and the weight. A quiet ring that fills when it is done - no colour
            change on the card, no strikethrough, nothing to celebrate. */}
        <ThemedView
          type={done ? 'accentDeep' : 'background'}
          style={[styles.tick, !done && { borderColor: theme.backgroundSelected, borderWidth: 1.5 }]}
        >
          {done && (
            <Ionicons name="checkmark" size={15} color={theme.background} />
          )}
        </ThemedView>
      </Pressable>

      <View style={styles.rowBody}>
        <ThemedText type="small">{exercise.name}</ThemedText>
        {(meta || workingWeightKg != null) && (
          <ThemedText type="small" themeColor="textSecondary">
            {[meta, workingWeightKg != null ? `Working weight · ${workingWeightKg} kg` : null]
              .filter(Boolean)
              .join('  ·  ')}
          </ThemedText>
        )}
      </View>

      {/* The eye opens the movement itself: the note before starting, the
          demonstration, and the working weight. */}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`About ${exercise.name}`}
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="eye-outline" size={18} color={theme.textSecondary} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  group: { gap: Spacing.two, paddingTop: Spacing.three },
  heading: { paddingBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  rowBody: { flex: 1, gap: Spacing.half },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  primary: {
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  quiet: { paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
