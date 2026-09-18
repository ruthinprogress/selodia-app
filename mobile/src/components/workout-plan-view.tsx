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
import { splitAdditional } from '@/lib/additional-movement';
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
// NO PERCENTAGES, NO COMPARISON WITH THE ROUTINE (Ruth, 2026-09-18, refining
// this screen): "the movement plan is not a checklist to complete and users
// should never feel they're being scored or judged against it. These are
// suggested movement practices based on what has worked previously."
//
// So the count says how much movement was recorded, never how much of the plan
// was got through: "4 movements recorded", with "2 completed - 2 adapted"
// underneath. Never "4 of 6", never "67%". The first is a record of a day; the
// second two are marks out of ten against a guide that was never a target.
//
// AND THE WORDS CARRY THAT TOO. "Done" is the language of a task list. Completed
// is what a person does with a movement, Adapted is what they do when their
// shoulder says otherwise, and neither is better than the other.

type MovementState = 'todo' | 'completed' | 'adapted' | 'skipped';

const NEXT_STATE: Record<MovementState, MovementState> = {
  todo: 'completed',
  completed: 'adapted',
  adapted: 'skipped',
  skipped: 'todo',
};

const STATE_LABEL: Record<MovementState, string> = {
  todo: '',
  completed: 'Completed',
  adapted: 'Adapted',
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
  // ANYTHING ELSE SHE DID, kept apart from what was different about the routine
  // (Ruth, 2026-09-18: "sometimes I do some of a workout and just some other
  // stuff that's not in it at all. So not necessarily an addition to a listed
  // movement, not a change"). Box jumps belong to the session and to no movement
  // in it; filing them under "what changed" would record real work as an
  // amendment to something else.
  const [extras, setExtras] = useState('');
  const [noteNotice, setNoteNotice] = useState<string | null>(null);

  const stateOf = (name: string): MovementState => states[name] ?? 'todo';
  // Adapted still counts as movement recorded: she did it, differently. What the
  // adaptation WAS belongs in her note rather than in a category.
  const doneMovements = plan.exercises.filter((x) =>
    ['completed', 'adapted'].includes(stateOf(x.name))
  );
  const adapted = plan.exercises.filter((x) => stateOf(x.name) === 'adapted');
  const skipped = plan.exercises.filter((x) => stateOf(x.name) === 'skipped');
  // Additional movement alone is enough to record a day: somebody who opened
  // the routine, did none of it and went climbing for twenty minutes has moved,
  // and the footer must not refuse to write that down.
  const touched = doneMovements.length > 0 || skipped.length > 0 || extras.trim().length > 0;

  function cycle(x: PlanExerciseView) {
    setStates((s) => ({ ...s, [x.name]: NEXT_STATE[stateOf(x.name)] }));
    setSaved(null);
    setFailed(false);
  }

  // The states become a sentence the log can carry: workout_completion_log
  // records what was done and has nowhere to put a skip. Her own words come
  // first; this is appended so the record is complete without her repeating it.
  // Additional movement becomes movement in its own right (see
  // lib/additional-movement.ts), so it is NOT repeated into the note - it is
  // already in the record as rows of its own.
  const additional = splitAdditional(extras);

  function composedNote(): string {
    const parts: string[] = [];
    if (note.trim()) parts.push(note.trim());
    if (adapted.length) parts.push(`Adapted: ${adapted.map((x) => x.name).join(', ')}.`);
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
      // THE SAME CALL FOR ANYTHING ELSE SHE MOVED THROUGH. No eccentric load and
      // no intensity: the plan classified its own movements at authoring time
      // and nothing has classified these, so they go in honestly unrated rather
      // than guessed at from their names.
      for (const name of additional) {
        await authedPost('/api/log-workout-completion', {
          planId,
          planTitle,
          exerciseName: name,
          eccentricLoad: null,
          intensity: null,
          note: composed || null,
        });
      }
      setReviewing(false);
      const total = doneMovements.length + additional.length;
      setSaved(
        `Recorded: ${total} movement${total === 1 ? '' : 's'}. Working weights kept for next time.`
      );
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  // WHAT WAS RECORDED, never what was got through. The plan's own length does
  // not appear: naming it invites the subtraction this screen exists to avoid.
  const recordedCount = doneMovements.length + additional.length;
  const recordedLine = `${recordedCount} movement${recordedCount === 1 ? '' : 's'} recorded`;
  const breakdown = [
    doneMovements.length - adapted.length > 0
      ? `${doneMovements.length - adapted.length} completed`
      : null,
    adapted.length > 0 ? `${adapted.length} adapted` : null,
    additional.length > 0 ? `${additional.length} added` : null,
    skipped.length > 0 ? `${skipped.length} skipped` : null,
  ]
    .filter(Boolean)
    .join('  •  ');

  const reviewLines: ReviewLine[] = [
    { label: 'Routine', value: planTitle },
    { label: 'Movements', value: recordedLine, detail: breakdown || undefined },
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
            {touched ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {recordedLine}
                </ThemedText>
                {breakdown.length > 0 && (
                  <ThemedText type="detail" themeColor="textSecondary">
                    {breakdown}
                  </ThemedText>
                )}
              </>
            ) : (
              <ThemedText type="detail" themeColor="textSecondary">
                Tapping a circle moves it between completed, adapted and skipped.
              </ThemedText>
            )}
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
          onNote={setNote}
          extras={extras}
          onExtras={setExtras}
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
  const done = state === 'completed' || state === 'adapted';

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
        accessibilityHint="Moves between completed, adapted and skipped"
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
          {state === 'completed' && <Ionicons name="checkmark" size={14} color={theme.background} />}
          {state === 'adapted' && <Ionicons name="repeat" size={13} color={theme.background} />}
          {state === 'skipped' && <Ionicons name="remove" size={14} color={theme.textSecondary} />}
        </ThemedView>
      </Pressable>

      <View style={styles.rowBody}>
        <ThemedText type="small" style={state === 'skipped' ? styles.skippedName : undefined}>
          {exercise.name}
        </ThemedText>
        {(meta || workingWeightKg != null || state !== 'todo') && (
          <ThemedText type="detail" themeColor="textSecondary">
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

// A MAGAZINE PAGE, NOT AN ACCESSIBILITY MODE (Ruth, 2026-09-18: "the current
// layout feels oversized... Selodia should feel calm, elegant and editorial
// rather than oversized"). Every measure below came down by roughly a quarter -
// card padding 16 to 12, the gap between cards 8 to 6, the space under a heading
// and above the footer 24 to 16 - and the secondary line dropped from 14 to 12.
// Nothing lost its air; the air stopped being the subject.
const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  group: { gap: 6, paddingTop: Spacing.three },
  // Tight to the first card beneath it: a heading belongs to what follows it,
  // and eight points of daylight made it read as its own paragraph.
  heading: { paddingBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: CardRadius,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBody: { flex: 1, gap: 1 },
  // Skipped is quieter, never struck through: a line through a movement reads
  // as a failure crossed off rather than a choice made.
  skippedName: { opacity: 0.6 },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  primary: {
    borderRadius: ButtonRadius,
    paddingVertical: 10,
    paddingHorizontal: Spacing.four,
  },
  quiet: { paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
