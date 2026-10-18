import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, PageInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedGet } from '@/lib/api';

// THE WHOLE LADDER, NOT JUST THE RUNG SHE IS ON.
//
// Ruth, 16 October 2026, on why the library was scoped as complete sets rather
// than as whichever movements happened to be missing a clip: "I want to be able
// to present a beautiful 'set progression'."
//
// A progression is the one thing a movement card cannot say on its own. "Wall
// walk, 3x5" tells you what to do today. It does not tell you that it is the
// second of seven, that a wall plank hold comes before it, or that the thing at
// the top is a freestanding handstand - which is the part that makes a person
// keep going. The stages are the answer to "how long is this going to take",
// and that question is asked silently and often.
//
// IT SHOWS THE STAGES SHE IS NOT ON, DELIBERATELY. The easy version would list
// only what she can do now. But a ladder you can see the top of is the point:
// care drops off before it starts, and "here is the whole thing, and here is
// where you are in it" is the opposite of being handed a single exercise with
// no horizon.
//
// NOTHING HERE IS A TARGET OR A SCHEDULE. There is no "you are 43% of the way",
// no estimate of weeks, no next-stage-unlocked. Ruth, on the last rung of the
// handstand ladder: "I actually don't know, it depends on your body, background
// and psychology. There isn't one way." So the stages are numbered and ordered
// and nothing more is claimed about them.

const ASPECT_RATIO = 4 / 5;

type Stage = {
  ref: string;
  title: string;
  stage: number;
  url: string;
  animationUrl: string | null;
};

export function MovementProgression({
  progression,
  currentRef,
  onClose,
}: {
  progression: string;
  /** The stage the person arrived from, marked so she can find herself in the set. */
  currentRef?: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedGet<{ illustrations: Stage[] }>('/api/movement-illustration', {
        progression,
      });
      setStages(res.illustrations ?? []);
    } catch {
      setFailed(true);
    }
  }, [progression]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={styles.centre} pointerEvents="box-none">
        <ThemedView style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.body}>
            <ThemedText type="sectionTitle">{progression}</ThemedText>

            {/* THE COUNT IS STATED PLAINLY AND NOTHING IS PROMISED ABOUT IT.
                "Seven stages" is a fact. "Seven weeks" would be an invention,
                and an intimidating one. */}
            {stages && stages.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {stages.length === 1 ? '1 stage' : `${stages.length} stages`}
              </ThemedText>
            )}

            {!stages && !failed && (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.textSecondary} />
              </View>
            )}

            {/* A FAILURE SAYS SO HERE, unlike the single illustration, which is
                silent. She asked to see this, so an empty sheet with no
                explanation would read as the app being broken rather than as
                there being nothing to show. */}
            {failed && (
              <ThemedText type="small" themeColor="textSecondary">
                Could not load the stages just now.
              </ThemedText>
            )}

            {stages?.map((stage) => {
              const here = currentRef != null && stage.ref === currentRef;
              return (
                <View key={stage.ref} style={styles.stage}>
                  <View style={styles.stageHead}>
                    {/* The number carries the order. Where she is, is marked on
                        the number rather than by hiding or dimming the others. */}
                    <View
                      style={[
                        styles.pip,
                        { borderColor: theme.backgroundSelected },
                        here && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                    >
                      <ThemedText
                        type="detail"
                        themeColor={here ? 'background' : 'textSecondary'}
                        style={text.pipText}
                      >
                        {stage.stage}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={text.stageTitle}>
                      {stage.title}
                    </ThemedText>
                  </View>

                  {/* accentDeep, not accent: the theme file records that the
                      accent at full strength is for fills and large type, and
                      that accentDeep is the one that clears AA on light. This
                      is small text. */}
                  {here && (
                    <ThemedText type="detail" themeColor="accentDeep" style={text.hereText}>
                      WHERE YOU ARE
                    </ThemedText>
                  )}

                  <View style={[styles.slot, { aspectRatio: ASPECT_RATIO }]}>
                    <Image
                      style={picture.image}
                      source={{ uri: stage.url }}
                      contentFit="contain"
                      transition={160}
                      accessibilityLabel={`Stage ${stage.stage}, ${stage.title}: an illustration showing the start position above and the finish position below`}
                    />
                    {/* The same app-drawn labels as the single illustration, for
                        the same reasons - a screen reader cannot read a painted
                        word. See movement-illustration.tsx. */}
                    <View style={[styles.label, styles.labelTop]}>
                      <ThemedText type="detail" themeColor="textSecondary" style={text.labelText}>
                        START
                      </ThemedText>
                    </View>
                    <View style={[styles.label, styles.labelBottom]}>
                      <ThemedText type="detail" themeColor="textSecondary" style={text.labelText}>
                        FINISH
                      </ThemedText>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
            <ThemedText type="small" themeColor="textSecondary">
              Close
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

// EACH SHEET IS TYPED RATHER THAN INFERRED. StyleSheet.create falls back to
// `ViewStyle | TextStyle | ImageStyle` for every entry whenever it cannot
// narrow the object it is given, and a View then refuses the result with an
// error about `cursor` that names nothing to do with the real cause. Saying
// which kind of style each sheet holds costs one line and removes the whole
// class of problem.
const styles = StyleSheet.create<Record<string, ViewStyle>>({
  // Geometry only, as in almanac-detail: the colour comes from theme.scrim at
  // render. Spreading absoluteFillObject here widens the inferred style type
  // across the whole sheet and the View props stop type-checking.
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: PageInset.horizontal },
  sheet: { maxHeight: '88%', borderRadius: CardRadius, overflow: 'hidden' },
  body: { padding: Spacing.three, gap: Spacing.two },
  loading: { paddingVertical: Spacing.four, alignItems: 'center' },
  stage: { gap: Spacing.one, marginTop: Spacing.two },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: { width: '100%', borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', left: Spacing.two, paddingHorizontal: Spacing.one, paddingVertical: 2, borderRadius: 999 },
  labelTop: { top: Spacing.two },
  labelBottom: { top: '52%' },
  close: { padding: Spacing.three, alignSelf: 'flex-end' },
});

// TEXT STYLES LIVE IN THEIR OWN SHEET, which is not tidiness. StyleSheet.create
// infers one type across everything it is given, so a single text property in a
// sheet of view styles widens every entry to TextStyle | ViewStyle | ImageStyle
// and the View props stop type-checking - with an error about `cursor` that
// names none of this.
// The image style goes in its own sheet for the same reason as the text
// styles: expo-image's Image contributes ImageStyle to the inferred union.
const picture = StyleSheet.create<Record<string, ImageStyle>>({
  image: { width: '100%', height: '100%' },
});

const text = StyleSheet.create<Record<string, TextStyle>>({
  pipText: { lineHeight: 24 },
  stageTitle: { flexShrink: 1 },
  hereText: { letterSpacing: 1, marginLeft: 32 },
  labelText: { letterSpacing: 1 },
});
