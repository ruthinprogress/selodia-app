import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanExerciseView, PlanView } from '@/lib/almanac-content';
import { authedPost } from '@/lib/api';
import { exerciseMetaLine, groupPlanExercises, shouldGroup } from '@/lib/workout-plan';

// The Workouts category page (build item 35, slice D) — the interactive view of
// a saved training plan, replacing the read-only detail for plan-shaped entries.
//
// Grouping is derived from the program type rather than hardcoded (Part Ten):
// general strength groups by body area, skill-practice by the skill, rehab is
// flat, and anything else is a plain list. See workout-plan.ts.
//
// The checkbox WRITES. It posts to /api/log-workout-completion rather than
// inserting directly, because a completion also keeps the session's single
// activity_logs row in step - rolling eccentric load up as the highest across
// the session so the DOMS flag sees the hardest work. A direct client insert
// would skip that silently.
//
// Each row shows its current working weight, read as the LATEST entry in the
// append-only history (slice E) — never a value stored on the plan, which is a
// document and must not carry state the log owns.
//
// NOT here, deliberately: the movement-demo animation (item 36 — no assets
// exist), which would be a dead control, exactly what principle 8 rules out.

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
  // Headings already carry the group, so repeating it on every row would be
  // noise; an ungrouped plan shows it inline instead.
  const showGroupInline = !shouldGroup(plan.programType);

  // Ticks are local for the session. Completion is append-only by design - a
  // durable row per completed exercise - so this is not a checkbox that can be
  // unticked into deleting history; it just reflects what has been logged since
  // the page opened.
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  async function tick(x: PlanExerciseView) {
    if (done[x.name]) return;
    setDone((d) => ({ ...d, [x.name]: true }));
    setFailed((f) => ({ ...f, [x.name]: false }));
    try {
      await authedPost('/api/log-workout-completion', {
        planId,
        planTitle,
        exerciseName: x.name,
        eccentricLoad: null,
        intensity: null,
      });
    } catch {
      // Roll the tick back and say so. Silently keeping it ticked would tell
      // the person their session was recorded when it was not.
      setDone((d) => ({ ...d, [x.name]: false }));
      setFailed((f) => ({ ...f, [x.name]: true }));
    }
  }

  return (
    <View style={styles.wrap}>
      {plan.goal && (
        <ThemedText type="small" themeColor="textSecondary">
          {plan.goal}
        </ThemedText>
      )}

      {groups.map((g, gi) => (
        <View key={g.heading ?? `__ungrouped-${gi}`} style={styles.group}>
          {g.heading && (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>
              {g.heading}
            </ThemedText>
          )}
          {g.exercises.map((x, i) => (
            <ExerciseRow
              key={`${x.name}-${i}`}
              exercise={x}
              showGroup={showGroupInline}
              done={done[x.name] === true}
              failed={failed[x.name] === true}
              workingWeightKg={weights.get(x.name) ?? null}
              onTick={() => tick(x)}
              onOpen={() => onOpenExercise(x)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function ExerciseRow({
  exercise,
  showGroup,
  done,
  failed,
  workingWeightKg,
  onTick,
  onOpen,
}: {
  exercise: PlanExerciseView;
  showGroup: boolean;
  done: boolean;
  failed: boolean;
  workingWeightKg: number | null;
  onTick: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const meta = exerciseMetaLine(exercise, workingWeightKg, showGroup);

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={styles.rowMain}>
        <Checkbox checked={done} onToggle={onTick} label={exercise.name} />
        {meta.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {meta}
          </ThemedText>
        )}
        {failed && (
          <ThemedText type="small" style={[styles.meta, { color: theme.danger }]}>
            Couldn&apos;t record that. Tap to try again
          </ThemedText>
        )}
      </View>

      {/* The universal "view detail" affordance, same icon and meaning as on a
          food entry or a measurement row (Established Design-System Elements). */}
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
  wrap: { gap: Spacing.three, marginTop: Spacing.two },
  group: { gap: Spacing.one },
  heading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  meta: { fontSize: 11, lineHeight: 16, marginLeft: 32 },
  pressed: { opacity: 0.6 },
});
