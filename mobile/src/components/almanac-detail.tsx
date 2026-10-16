import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MovementDemo } from '@/components/movement-demo';
import { MovementIllustration } from '@/components/movement-illustration';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, PageInset, Spacing } from '@/constants/theme';
import { WorkingWeightControl } from '@/components/working-weight-control';
import { supabase } from '@/lib/supabase';
import { WorkoutPlanView } from '@/components/workout-plan-view';
import { readContent, type ContentView, type PlanExerciseView } from '@/lib/almanac-content';
import { latestWeightByExercise } from '@/lib/working-weight';

// The Almanac entry detail (build item 15, UI slice 3).
//
// Renders by the SHAPE of the content, never by `kind` — kind is open text, so
// switching on it would rebuild the closed list principle 13 rules out. An
// unfamiliar shape still renders readably rather than showing nothing: an entry
// the person agreed to save must never open to a blank page.
//
// READ-ONLY. The Almanac is never edited in place; the edit affordance opens a
// chat dialogue so Selodia stays the single writer and there is no direct-edit
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
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const planId = entry?.id ?? null;

  // "Current = latest", read from the append-only history rather than any value
  // stored on the plan - the plan is a document and must not carry state that
  // the log owns (Part Ten).
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('workout_weight_log')
        .select('exercise_name, weight_kg, logged_at')
        .eq('plan_id', planId)
        .order('logged_at', { ascending: false });
      if (!cancelled) setWeights(latestWeightByExercise(data ?? []));
    })();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const theme = useTheme();

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
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
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
                weights={weights}
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
        <ExerciseDetail
          exercise={openExercise}
          planId={entry.id}
          currentKg={weights.get(openExercise.name) ?? null}
          onLogged={(kg) =>
            setWeights((w) => new Map(w).set(openExercise.name, kg))
          }
          onClose={() => setOpenExercise(null)}
        />
      )}
    </Modal>
  );
}

// THE EXERCISE SHEET (build item 35 slice D, redrawn 2026-09-18 to Ruth's
// Movement brief).
//
// FOUR THINGS, IN THIS ORDER, and the order is the design: what to watch for
// before you begin, what the movement looks like, what you are lifting, and the
// way out. Part Ten fixed the first two - the safety note comes FIRST, because
// it is what matters before somebody loads a bar, not a footnote under the demo.
//
// The movement-demo animation renders NOTHING when the library has no asset for
// the movement - not a placeholder and not an explanation - because the library
// covers movement patterns rather than every named exercise, and item 46 handles
// that gap in conversation without ever naming the library's limits.
//
// "Ask about this" is still held: it is the discuss-card mechanic, and an
// exercise is not a valid discuss_entry_type today (it lives inside a plan's
// JSONB rather than being a row with an id). A recorded gap, not an oversight.
function ExerciseDetail({
  exercise,
  planId,
  currentKg,
  onLogged,
  onClose,
}: {
  exercise: PlanExerciseView;
  planId: string;
  currentKg: number | null;
  onLogged: (kg: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [weightsOpen, setWeightsOpen] = useState(false);
  // COLLAPSED UNTIL ASKED FOR, by movement name. Shut by default because the
  // card above is what she opened this for; the note is for the person who
  // wants it, and only she knows which she is today.
  const [openNote, setOpenNote] = useState<string | null>(null);

  // What the plan says about this movement, stated once under the name: the
  // body area it belongs to, and the sets and reps decided in the conversation
  // that built the plan. Never recomputed here - they are stored on the plan.
  const meta = [exercise.group, exercise.sets && exercise.reps ? `${exercise.sets}×${exercise.reps}` : null]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={styles.centre} pointerEvents="box-none">
        <ThemedView style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {/* The movement names itself in the serif, as every other thing in
                the app does since the typography was settled. */}
            <ThemedText type="sectionTitle">{exercise.name}</ThemedText>
            {meta.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {meta}
              </ThemedText>
            )}


            {/* THE BOX IS ONLY DRAWN WHEN IT HAS SOMETHING IN IT (Ruth, 15
                October 2026): "The body movement info is under the blank
                movement area which makes it look like its broken." An empty
                framed panel with the words underneath reads as a video that
                failed to load. Where there are words instead of a clip, the
                words take the panel's place rather than queue behind it. */}
            {exercise.demoRef || !exercise.howTo ? (
              <MovementDemo exerciseName={exercise.name} demoRef={exercise.demoRef} />
            ) : null}

            {/* AND WHERE THERE IS NO CLIP, A DRAWING (16 October 2026).
                The library covers movement patterns, not every named exercise,
                so most movements arrive with nothing to watch. Rather than bend
                the programme to the asset list - "it cant just choose exercises
                with videos... that surely is its job" - the gap is closed from
                the other side with illustrations Selodia owns.

                SHOWN EXACTLY WHERE THE RECIPE CARD IS SHOWN, which is to say
                wherever the save found no clip. That condition is already
                settled and already correct, so this adds a rung to the ladder
                without touching how the existing one decides anything:

                    a clip, if the library has one
                    an illustration, if we have drawn it
                    the recipe card, always, underneath

                RENDERS NOTHING WHEN WE HAVE NOT DRAWN IT, like MovementDemo.
                Nine movements are drawn so far; a miss is the ordinary case. */}
            {!exercise.demoRef && exercise.howTo ? (
              <MovementIllustration exerciseName={exercise.name} />
            ) : null}

            {/* AND WHEN THERE IS NO CLIP, WORDS (15 October 2026).
                Ruth, on the plan she built for her knee: "one one exercise had
                a video and I have no idea how to do the rest. Needs a solution
                before shipping or it's no use at all." Thirteen of her
                forty-five movements have a demonstration.

                Shown only when there is no clip - beside a video this is noise
                - and drawn as its own lines, because "Set up / Do / Feel it"
                run together is the wall of text she spent this morning getting
                rid of.

                THE CARD'S ORDER CHANGED WITH IT. Part Ten put the safety note
                first, on the reasoning that it is what matters before somebody
                loads a bar. That held while the demonstration was a video she
                could already picture; it stopped holding once the how-to became
                the thing she opens the card for. A caution read before the
                movement it describes is a caution about nothing. */}
            {!exercise.demoRef && exercise.howTo ? (
              <View style={styles.howToCard}>
                {/* WHAT SHE NEEDS TO HAVE TO HAND, first and on one line,
                    because standing up to fetch a dumbbell halfway through is
                    where a session stops. Absent for bodyweight. */}
                {exercise.howTo.needs.length > 0 ? (
                  <View style={styles.howToNeeds}>
                    <Ionicons name="barbell-outline" size={14} color={theme.textSecondary} />
                    <ThemedText type="detail" themeColor="textSecondary">
                      {exercise.howTo.needs.join(' · ')}
                    </ThemedText>
                  </View>
                ) : null}

                {/* THE STEPS, NUMBERED. Little chunks read as "I can do that";
                    a paragraph reads as "I will read that later". */}
                {exercise.howTo.steps.map((step, i) => (
                  <View key={step} style={styles.howToStep}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.howToNumber}>
                      {`${i + 1}`}
                    </ThemedText>
                    <ThemedText type="small" style={styles.howToStepText}>
                      {step}
                    </ThemedText>
                  </View>
                ))}

                {/* WHERE IT SHOULD BE FELT, which is how she checks herself
                    without anybody watching. */}
                <View style={styles.howToNeeds}>
                  <Ionicons name="body-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="detail" themeColor="textSecondary">
                    {exercise.howTo.feel}
                  </ThemedText>
                </View>

                {/* THE ONE OR TWO THINGS THAT GO WRONG, short. The full note is
                    behind More below, for whoever wants it. */}
                {exercise.howTo.avoid.map((a) => (
                  <View key={a} style={styles.howToNeeds}>
                    <Ionicons name="alert-circle-outline" size={14} color={theme.textSecondary} />
                    <ThemedText type="detail" themeColor="textSecondary">
                      {a}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {/* THE LONG NOTE IS BEHIND A TAP (Ruth, 16 October 2026). It led
                the card, then moved to the bottom, and both were wrong for the
                same reason: "The page is asking people to study when they came
                to move... she has a small amount of motivation and reading
                uses it up. Use it up reading a bunch and the moment passes and
                you've not moved."

                The one or two things that actually go wrong are already on the
                card above, in a line each. This is the fuller version for
                whoever wants it, and the title says what is behind it - "Before
                you begin" told her when to read it and never what she would
                get, which is not a name that earns a tap. */}
            {exercise.safetyNote ? (
              <Pressable
                onPress={() => setOpenNote((was) => (was === exercise.name ? null : exercise.name))}
                accessibilityRole="button"
                accessibilityState={{ expanded: openNote === exercise.name }}
                style={styles.moreRow}
              >
                <ThemedText type="detail" themeColor="textSecondary">
                  {'What usually goes wrong'}
                </ThemedText>
                <Ionicons
                  name={openNote === exercise.name ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={theme.textSecondary}
                />
              </Pressable>
            ) : null}
            {exercise.safetyNote && openNote === exercise.name ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.howToStepText}>
                {exercise.safetyNote}
              </ThemedText>
            ) : null}

            {/* BEHIND A TOGGLE UNTIL THERE IS A WEIGHT (Ruth, 2026-09-10).
                Found on device: a sumo squat and a side-lying leg lift both
                showed a stepper reading 0 kg, a slider whose fill was zero
                width and so looked like an empty bar, and a save button -
                three controls for a load that does not exist. That is what
                principle 8 rules out.

                Not removed for bodyweight movements, though, which was the
                first instinct: Ruth's reaction to the control was that it
                "felt like something I could work towards". Hiding it entirely
                would take that away, and the app cannot reliably tell which
                movements are loadable anyway - a plan carries no equipment
                field, and guessing from the name is the same class of
                inference the movement matching already refuses to make.

                So it is offered rather than presented. Once a weight exists
                the control opens on its own, because at that point it is a
                record rather than an invitation. */}
            {currentKg != null || weightsOpen ? (
              <WorkingWeightControl
                planId={planId}
                exerciseName={exercise.name}
                currentKg={currentKg}
                onLogged={onLogged}
              />
            ) : (
              <Pressable
                onPress={() => setWeightsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Add weights to this exercise"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type="backgroundElement" style={styles.addWeights}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Add weights
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          </ScrollView>

          <View style={styles.sheetActions}>
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
  // THE EXERCISE SHEET's own surface, which is roomier than the entry card
  // above it: one movement at a time, with the page inset the UI pass gave
  // every other screen rather than the tight 16 the old sheet used.
  sheet: { borderRadius: CardRadius, maxHeight: '86%', overflow: 'hidden' },
  sheetBody: { padding: PageInset.horizontal, paddingBottom: Spacing.four, gap: Spacing.three },
  sheetActions: {
    paddingHorizontal: PageInset.horizontal,
    paddingBottom: Spacing.four,
    alignItems: 'flex-end',
  },
  beforeCard: { padding: Spacing.three, borderRadius: CardRadius, gap: Spacing.one },
  // One line per step, with room under each so the three read as three things
  // to do rather than a paragraph.
  // A CARD, NOT A PANEL. No fill behind it: the steps are the content of this
  // screen rather than an aside, and a tinted box around them says "extra".
  howToCard: { gap: Spacing.one, paddingVertical: Spacing.one },
  howToNeeds: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  howToStep: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  // Tabular, so 1 2 3 line up down the left and the sentences start together.
  howToNumber: { fontVariant: ['tabular-nums'], minWidth: 12 },
  howToStepText: { flex: 1, lineHeight: 20 },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  addWeights: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.one,
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Colour comes from theme.scrim at render; only the geometry lives here.
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
  pressed: { opacity: 0.6 },
});
