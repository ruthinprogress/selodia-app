import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { WorkoutPlanView } from '@/components/workout-plan-view';
import { readContent, type ContentView, type PlanExerciseView } from '@/lib/almanac-content';

// The Almanac entry detail (build item 15, UI slice 3).
//
// Renders by the SHAPE of the content, never by `kind` — kind is open text, so
// switching on it would rebuild the closed list principle 13 rules out. An
// unfamiliar shape still renders readably rather than showing nothing: an entry
// the person agreed to save must never open to a blank page.
//
// READ-ONLY. The Almanac is never edited in place; the edit affordance opens a
// chat dialogue so Unflump stays the single writer and there is no direct-edit
// path to keep in sync with the conversational one (Part Ten, Editing).

export type DetailEntry = {
  id: string;
  kind: string;
  title: string;
  category: string | null;
  content: unknown;
};

export function AlmanacDetail({
  entry,
  onClose,
  onEdit,
}: {
  entry: DetailEntry | null;
  onClose: () => void;
  onEdit: (entry: DetailEntry) => void;
}) {
  const [openExercise, setOpenExercise] = useState<PlanExerciseView | null>(null);
  if (!entry) return null;
  const view = readContent(entry.content);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.centre} pointerEvents="box-none">
        <ThemedView style={styles.card}>
          <ScrollView contentContainerStyle={styles.body}>
            <ThemedText type="smallBold">{entry.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.kind}>
              {entry.category ? `${entry.category} · ${entry.kind}` : entry.kind}
            </ThemedText>

            {view.shape === 'plan' ? (
              <WorkoutPlanView
                planId={entry.id}
                planTitle={entry.title}
                plan={view.plan}
                onOpenExercise={setOpenExercise}
              />
            ) : (
              <Content view={view} />
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={() => onEdit(entry)} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.action}>
                <ThemedText type="smallBold">Update this</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>

      {openExercise && (
        <ExerciseDetail exercise={openExercise} onClose={() => setOpenExercise(null)} />
      )}
    </Modal>
  );
}

// The exercise detail (build item 35, slice D). Part Ten fixes the order:
// the "Before you start" safety note comes FIRST - it is the thing that matters
// before someone loads a bar, not a footnote under the demo.
//
// The movement-demo animation belongs here next, and is deliberately absent:
// item 36's assets do not exist yet, and an empty media slot would be exactly
// the dead placeholder principle 8 rules out. "Ask about this" is likewise
// held - it is the discuss-card mechanic, and an exercise is not currently a
// valid discuss_entry_type (it lives inside a plan's JSONB rather than being a
// row with an id). Both are recorded gaps, not oversights.
function ExerciseDetail({
  exercise,
  onClose,
}: {
  exercise: PlanExerciseView;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.centre} pointerEvents="box-none">
        <ThemedView style={styles.card}>
          <ScrollView contentContainerStyle={styles.body}>
            <ThemedText type="smallBold">{exercise.name}</ThemedText>

            {exercise.safetyNote ? (
              <ThemedView type="backgroundElement" style={styles.safety}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                  Before you start
                </ThemedText>
                <ThemedText type="small">{exercise.safetyNote}</ThemedText>
              </ThemedView>
            ) : (
              // Every exercise card requires a safety note by rule. Saying it is
              // missing is honest; inventing generic boilerplate would break the
              // never-generic rule and be worse than silence.
              <ThemedText type="small" themeColor="textSecondary">
                No safety note saved for this one yet.
              </ThemedText>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function Content({ view }: { view: ContentView }) {
  switch (view.shape) {
    case 'insight':
      // An insight is a rule, not prose: when X, expect Y. Rendering it as the
      // two halves keeps that legible, and matches how the layer will read it.
      return (
        <View style={styles.block}>
          <Label text="When" />
          <ThemedText type="small">{view.rule.condition}</ThemedText>
          <Label text="Expect" />
          <ThemedText type="small">{view.rule.expectation}</ThemedText>
        </View>
      );

    case 'plan':
      return (
        <View style={styles.block}>
          {view.plan.goal && <ThemedText type="small">{view.plan.goal}</ThemedText>}
          {view.plan.exercises.map((x, i) => (
            <View key={`${x.name}-${i}`} style={styles.exercise}>
              <ThemedText type="small" style={styles.exerciseName}>
                {x.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.smallLine}>
                {[x.group, x.sets && x.reps ? `${x.sets}×${x.reps}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
              {x.safetyNote && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.smallLine}>
                  {x.safetyNote}
                </ThemedText>
              )}
            </View>
          ))}
        </View>
      );

    case 'summary':
      return (
        <View style={styles.block}>
          <ThemedText type="small">{view.text}</ThemedText>
        </View>
      );

    case 'fields':
      return (
        <View style={styles.block}>
          {view.fields.map((f) => (
            <View key={f.label}>
              <Label text={f.label} />
              <ThemedText type="small">{f.value}</ThemedText>
            </View>
          ))}
        </View>
      );

    case 'empty':
    default:
      // Honest rather than blank. Saying nothing at all would read as broken.
      return (
        <View style={styles.block}>
          <ThemedText type="small" themeColor="textSecondary">
            Nothing recorded against this one yet.
          </ThemedText>
        </View>
      );
  }
}

function Label({ text }: { text: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  centre: { flex: 1, justifyContent: 'center', padding: Spacing.three },
  card: { borderRadius: Spacing.three, maxHeight: '80%', overflow: 'hidden' },
  body: { padding: Spacing.three, gap: Spacing.one },
  kind: { fontSize: 11, textTransform: 'lowercase' },
  block: { gap: Spacing.one, marginTop: Spacing.two },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  exercise: { gap: 2, marginTop: Spacing.one },
  exerciseName: { fontWeight: '500' },
  smallLine: { fontSize: 11, lineHeight: 16 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    paddingTop: 0,
    gap: Spacing.two,
  },
  action: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  close: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  safety: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
