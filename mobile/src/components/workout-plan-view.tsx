import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutReviewSheet, type ReviewLine } from '@/components/workout-review-sheet';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanExerciseView, PlanView } from '@/lib/almanac-content';
import { authedPost } from '@/lib/api';
import { estimateMinutes } from '@/lib/movement-library';
import { exerciseMetaLine, groupPlanExercises, shouldGroup } from '@/lib/workout-plan';

// A saved practice, open (Ruth's brief and mockup, 2026-09-18, revised the same
// day).
//
// THE PHILOSOPHY THIS IS BUILT ON, in her words: "the goal is not to measure
// compliance with a predefined routine. The goal is to accurately record what
// actually happened." Three consequences, and every one reverses something that
// was here before:
//
//   1. A MOVEMENT HAS A STATE, NOT A PASS MARK. Done, changed, or skipped. None
//      of the three is a success or a failure - "skipped bench and went climbing
//      instead" is a fact about a day, not a shortfall.
//   2. A SESSION CAN BE SAVED AT ANY POINT. The footer is always there, and one
//      movement is enough. Waiting for a full house made the log a record of
//      completed programmes rather than of movement done, which is the opposite
//      of what this app is for.
//   3. NOTHING IS WRITTEN UNTIL SHE SAYS SO. A tick used to write a completion
//      the instant it was pressed, so a routine opened out of curiosity became a
//      half-finished workout in the Activity log, and a tick could never be
//      undone. The marks now live only while the sheet is open.
//
// WHAT SURVIVES REGARDLESS is the working weight: a fact about the movement,
// saved when she sets it. Tomorrow the routine opens unmarked, weights kept.
//
// NO PERCENTAGES, no streaks, no congratulation. "5 of 7" counts what happened;
// "71%" is the same fact turned into a mark, and this screen will not carry one.

type MovementState = 'todo' | 'done' | 'changed' | 'skipped';

const NEXT_STATE: Record<MovementState, MovementState> = {
  todo: 'done',
  done: 'changed',
  changed: 'skipped',
  skipped: 'todo',
};

const STATE_LABEL: Record<MovementState, string> = {
  todo: '',
  done: 'Done',
  changed: 'Changed',
  skipped: 'Skipped',
};

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

  const [states, setStates] = useState<Record<string, MovementState>>({});
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState('');
  const [noteNotice, setNoteNotice] = useState<string | null>(null);

  const stateOf = (name: string): MovementState => states[name] ?? 'todo';
  // Changed still counts as done: she did the movement, differently. What the
  // change WAS belongs in her note rather than in a category.
  const doneMovements = plan.exercises.filter((x) => ['done', 'changed'].includes(stateOf(x.name)));
  const changed = plan.exercises.filter((x) => stateOf(x.name) === 'changed');
  const skipped = plan.exercises.filter((x) => stateOf(x.name) === 'skipped');
  const touched = doneMovements.length > 0 || skipped.length > 0;

  function cycle(x: PlanExerciseView) {
    setStates((s) => ({ ...s, [x.name]: NEXT_STATE[stateOf(x.name)] }));
    setSaved(null);
    setFailed(false);
  }

  // The states become a sentence the log can carry: workout_completion_log
  // records what was done and has nowhere to put a skip. Her own words come
  // first; this is appended so the record is complete without her repeating it.
  function composedNote(): string {
    const parts: string[] = [];
    if (note.trim()) parts.push(note.trim());
    if (changed.length) parts.push(`Changed: ${changed.map((x) => x.name).join(', ')}.`);
    if (skipped.length) parts.push(`Skipped: ${skipped.map((x) => x.name).join(', ')}.`);
    return parts.join(' ');
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const composed = composedNote();
    try {
      // One post per movement done. The route keeps the session's single
      // activity_logs row in step - rolling eccentric load up as the highest
      // across the session, so the DOMS flag sees the hardest work - and a
      // direct insert from here would skip that silently.
      for (const x of doneMovements) {
        await authedPost('/api/log-workout-completion', {
          planId,
          planTitle,
          exerciseName: x.name,
          eccentricLoad: null,
          intensity: null,
          note: composed || null,
        });
      }
      setReviewing(false);
      setSaved(
        `Saved to today's Activity: ${doneMovements.length} of ${plan.exercises.length}. Working weights kept for next time.`
      );
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const reviewLines: ReviewLine[] = [
    { label: 'Routine', value: planTitle },
    {
      label: 'Movements',
      value: `${doneMovements.length} of ${plan.exercises.length}${changed.length ? `, ${changed.length} changed` : ''}${skipped.length ? `, ${skipped.length} skipped` : ''}`,
    },
    { label: 'Working weights', value: weights.size > 0 ? 'Kept as they are' : 'None recorded yet' },
  ];

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
            <ThemedText type="sectionTitle" style={styles.heading}>
              {g.heading}
            </ThemedText>
          )}
          {g.exercises.map((x, i) => (
            <ExerciseRow
              key={`${x.name}-${i}`}
              exercise={x}
              showGroup={showGroupInline}
              state={stateOf(x.name)}
              workingWeightKg={weights.get(x.name) ?? null}
              onCycle={() => cycle(x)}
              onOpen={() => onOpenExercise(x)}
            />
          ))}
        </View>
      ))}

      {/* ALWAYS THERE, never conditional on finishing. It offers to record the
          day rather than to complete the programme. */}
      <ThemedView type="backgroundElement" style={styles.footer}>
        {saved ? (
          <ThemedText type="small">{saved}</ThemedText>
        ) : (
          <>
            <ThemedText type="small">Record today&apos;s movement</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {touched
                ? `${doneMovements.length} done${changed.length ? `, ${changed.length} changed` : ''}${skipped.length ? `, ${skipped.length} skipped` : ''}`
                : 'Mark what you did as you go. Tapping a circle moves it between done, changed and skipped.'}
            </ThemedText>
            <View style={styles.footerActions}>
              <Pressable
                onPress={() => setReviewing(true)}
                disabled={!touched}
                accessibilityRole="button"
                accessibilityLabel="Save today's movement to Activity"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView
                  type={touched ? 'accentDeep' : 'backgroundSelected'}
                  style={styles.primary}
                >
                  <ThemedText type="smallBold" themeColor={touched ? 'background' : 'textSecondary'}>
                    Save to Activity
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStates({});
                  setNote('');
                }}
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
          </>
        )}
      </ThemedView>

      {reviewing && (
        <WorkoutReviewSheet
          title={planTitle}
          lines={reviewLines}
          note={note}
          onNoteText={(text) => setNote((n) => (n.trim() ? `${n.trim()} ${text}` : text))}
          onNotice={setNoteNotice}
          notice={noteNotice}
          saving={saving}
          onSave={() => void save()}
          onClose={() => setReviewing(false)}
        />
      )}
    </View>
  );
}

function ExerciseRow({
  exercise,
  showGroup,
  state,
  workingWeightKg,
  onCycle,
  onOpen,
}: {
  exercise: PlanExerciseView;
  showGroup: boolean;
  state: MovementState;
  workingWeightKg: number | null;
  onCycle: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  // The weight has its own place on the card, so it is left out of the meta.
  const meta = exerciseMetaLine(exercise, null, showGroup);
  const done = state === 'done' || state === 'changed';

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      {/* ONE CONTROL, FOUR STATES, in the order a session actually goes: not
          yet, done, done differently, not done. Drawn rather than taken from
          components/checkbox.tsx, which is a box AND its label as one control -
          right for a question in a sheet, wrong for a card that already carries
          the name, the sets and the weight. */}
      <Pressable
        onPress={onCycle}
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}${state === 'todo' ? '' : `, ${STATE_LABEL[state].toLowerCase()}`}`}
        accessibilityHint="Moves between done, changed and skipped"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView
          type={done ? 'accentDeep' : 'background'}
          style={[
            styles.mark,
            !done && { borderColor: theme.backgroundSelected, borderWidth: 1.5 },
            state === 'skipped' && { borderColor: theme.textSecondary },
          ]}
        >
          {state === 'done' && <Ionicons name="checkmark" size={15} color={theme.background} />}
          {state === 'changed' && <Ionicons name="repeat" size={14} color={theme.background} />}
          {state === 'skipped' && <Ionicons name="remove" size={15} color={theme.textSecondary} />}
        </ThemedView>
      </Pressable>

      <View style={styles.rowBody}>
        <ThemedText type="small" style={state === 'skipped' ? styles.skippedName : undefined}>
          {exercise.name}
        </ThemedText>
        {(meta || workingWeightKg != null || state !== 'todo') && (
          <ThemedText type="small" themeColor="textSecondary">
            {[
              meta,
              workingWeightKg != null ? `Last: ${workingWeightKg} kg` : null,
              STATE_LABEL[state] || null,
            ]
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
  // Skipped is quieter, never struck through: a line through a movement reads
  // as a failure crossed off rather than a choice made.
  skippedName: { opacity: 0.6 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  primary: {
    borderRadius: ButtonRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  quiet: { paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
