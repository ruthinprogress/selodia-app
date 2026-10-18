import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MovementProgression } from '@/components/movement-progression';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedGet } from '@/lib/api';

// THE DRAWN DEMONSTRATION, for a movement the clip library does not cover.
//
// This is the twin of movement-demo.tsx and follows its rules: the same 4:5
// portrait slot, the same silence when there is nothing to show, the same signed
// URL from a route rather than a file the app can address.
//
// WHAT IT RENDERS WHEN THERE IS NO ILLUSTRATION: nothing at all. Not a
// placeholder, not "no picture yet", not a greyed box. Nine movements are drawn
// out of a library of hundreds, so a miss is the ordinary case and will stay that
// way for a long time. A dead slot would say "this app is unfinished" on the one
// screen somebody opens when they are about to move.
//
// THE PICTURE HOLDS TWO FRAMES, start above and finish below, in one file. The
// app draws the START and FINISH words itself rather than having them painted in:
// a screen reader cannot read a word that is part of a picture, translating baked
// labels would mean regenerating the whole library, and generated lettering comes
// out subtly misspelled often enough to matter.
//
// AND THE WORDS STAY UNDERNEATH IT. A picture fixes one angle - one depth, one
// width of knee - and bodies differ. The recipe card below carries what the
// drawing cannot say, which is how far to go for YOUR body. See the coaching
// notes in scripts/illustration-progressions.mjs for where that language came
// from: Ruth's own, about the frog stretch and the cossack weight shift.

const ASPECT_RATIO = 4 / 5;

type Illustration = {
  ref: string;
  title: string;
  url: string;
  animationUrl: string | null;
  progression: string | null;
  stage: number | null;
  /** Ruth's own note on the movement. Null for most of them. */
  coaching: string | null;
};

export function MovementIllustration({
  exerciseName,
  illustrationRef,
}: {
  exerciseName: string;
  /** Preferred when a plan already resolved it at save time. */
  illustrationRef?: string | null;
}) {
  const theme = useTheme();
  const [illustration, setIllustration] = useState<Illustration | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'absent'>('loading');
  const [showProgression, setShowProgression] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedGet<{ illustration: Illustration | null }>(
        '/api/movement-illustration',
        illustrationRef ? { ref: illustrationRef } : { exercise: exerciseName }
      );
      if (!res.illustration) {
        setState('absent');
        return;
      }
      setIllustration(res.illustration);
      setState('ready');
    } catch {
      // A card showing its recipe instead of a picture is still a usable card, so
      // a failure here is silent in the same way an absence is. The person came to
      // move, not to be told about our storage.
      setState('absent');
    }
  }, [exerciseName, illustrationRef]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'absent') return null;

  if (state === 'loading') {
    return (
      <View style={[styles.slot, { aspectRatio: ASPECT_RATIO, backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.slot, { aspectRatio: ASPECT_RATIO }]}>
        <Image
          style={styles.image}
          source={{ uri: illustration!.url }}
          contentFit="contain"
          transition={160}
          accessibilityLabel={`${illustration!.title}: an illustration showing the start position above and the finish position below`}
        />

        {/* THE LABELS THE PICTURE DELIBERATELY DOES NOT CONTAIN. Positioned over
            the two halves of the slot, which is why every illustration in the
            library is the same shape and the same way up. */}
        <View style={[styles.label, styles.labelTop]}>
          <ThemedText type="detail" themeColor="textSecondary" style={styles.labelText}>
            START
          </ThemedText>
        </View>
        <View style={[styles.label, styles.labelBottom]}>
          <ThemedText type="detail" themeColor="textSecondary" style={styles.labelText}>
            FINISH
          </ThemedText>
        </View>
      </View>

      {/* WHAT THE PICTURE CANNOT SAY, IN RUTH'S OWN WORDS.

          A drawing fixes one height, one depth, one angle of knee, and bodies
          differ. The note says what to feel for and what changes when you alter
          something - her cossack note on pivoting the heel so the hip can
          travel, her side-lying note that the height of the lift is not the
          measure of it and moves with how the leg is turned.

          IT HAD NEVER BEEN SHOWN TO ANYBODY. The notes were written into
          scripts/illustration-progressions.mjs on 16 October and read by
          nothing at all until 18 October - the same fault as the illustration
          brief, which was also carefully written and imported by no one.

          NULL FOR MOST MOVEMENTS, and nothing is drawn then. She writes one
          where she has something to say, which is not every time, and a
          placeholder would turn a deliberate silence into a missing thing. */}
      {illustration!.coaching ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.coaching}>
          {illustration!.coaching}
        </ThemedText>
      ) : null}

      {/* THE WAY INTO THE LADDER, and the only place it can be offered from.
          A movement card knows what to do today; it cannot say that today is
          the second of seven. This line is drawn ONLY when the movement is
          part of a drawn progression, so it never promises a set that does not
          exist. See movement-progression.tsx. */}
      {illustration!.progression && (
        <Pressable
          onPress={() => setShowProgression(true)}
          accessibilityRole="button"
          accessibilityLabel={`See the whole ${illustration!.progression} progression`}
          style={styles.ladderLink}
        >
          {/* accentDeep, not accent: full-strength accent is for fills and
              large type, and does not clear AA at this size. */}
          <ThemedText type="small" themeColor="accentDeep">
            {illustration!.stage
              ? `Stage ${illustration!.stage} of ${illustration!.progression}  ·  see the whole set`
              : `See the whole ${illustration!.progression} set`}
          </ThemedText>
        </Pressable>
      )}

      {showProgression && illustration!.progression && (
        <MovementProgression
          progression={illustration!.progression}
          currentRef={illustration!.ref}
          onClose={() => setShowProgression(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  slot: { width: '100%', borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  label: { position: 'absolute', left: Spacing.two, paddingHorizontal: Spacing.one, paddingVertical: 2, borderRadius: 999 },
  labelTop: { top: Spacing.two },
  labelBottom: { top: '52%' },
  labelText: { letterSpacing: 1 },
  coaching: { lineHeight: 20 },
  ladderLink: { paddingVertical: Spacing.one },
});
