import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedGet } from '@/lib/api';

// The movement demonstration (build item 36) — the licensed animation for one
// exercise, shown inside the exercise detail beneath its safety note.
//
// WHAT IT RENDERS WHEN THERE IS NO ASSET: nothing at all. Not a placeholder, not
// "no demo available", not a greyed box. The library covers movement PATTERNS
// rather than every named exercise, so a miss is ordinary rather than broken,
// and principle 8 rules out dead slots. Item 46 handles the gap the only place
// it should be handled — in conversation, without ever referencing the library's
// limits. A caption here saying "no video for this" would break that rule from
// the one screen most likely to be looked at.
//
// WHY A SIGNED URL AND NOT A FILE: the clips are licensed, not ours. Exercise
// Animatic's terms (ToS 8.4) forbid allowing end users to download or extract
// them, so the bucket is private, the app cannot address storage, and every URL
// arrives from /api/movement-demo already signed and already dying. See Part Ten.

// The 4:5 portrait slot fixed in Part Ten. Wide and floor movements were handled
// at asset-prep by fitting the figure and padding with cream, so the padding is
// invisible against a cream page and nothing is ever cropped. Do not "fix" the
// letterboxing on a lunge — it is the design.
const ASPECT_RATIO = 4 / 5;

type Demo = {
  url: string;
  expiresIn: number;
  clip: string;
  muscleGroup: string;
  primaryMuscles: string[];
  movementPattern: string;
};

export function MovementDemo({ exerciseName }: { exerciseName: string }) {
  const theme = useTheme();
  const [demo, setDemo] = useState<Demo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'absent' | 'error'>('loading');

  const load = useCallback(async () => {
    try {
      const res = await authedGet<{ demo: Demo | null }>('/api/movement-demo', {
        exercise: exerciseName,
      });
      if (!res.demo) {
        setState('absent');
        return;
      }
      setDemo(res.demo);
      setState('ready');
    } catch {
      // Deliberately quiet. A demo failing to load is not worth an error message
      // on top of a safety note somebody is about to act on.
      setState('error');
    }
  }, [exerciseName]);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  // The signed URL expires (5 minutes). Somebody reading a safety note properly,
  // or leaving the sheet open, will outlast it — so refresh a little before the
  // clip stops being playable rather than after somebody notices.
  useEffect(() => {
    if (!demo) return;
    const ms = Math.max(30, demo.expiresIn - 30) * 1000;
    const t = setTimeout(() => void load(), ms);
    return () => clearTimeout(t);
  }, [demo, load]);

  const player = useVideoPlayer(demo?.url ?? null, (p) => {
    // Silent, looping, and it starts on its own. These are ten-second anatomical
    // loops with no audio track: a play button would be a control whose only
    // purpose is to make somebody press it before they can see the thing they
    // opened. prefers-reduced-motion is not consulted, and that is considered —
    // here the movement IS the content, not decoration around it.
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Nothing to show, and nothing to say about it.
  if (state === 'absent' || state === 'error') return null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        The movement
      </ThemedText>

      <View
        style={[
          styles.slot,
          // The recoloured clips are on cream and so is the page, so the slot
          // and the letterboxing disappear into each other.
          { backgroundColor: theme.background, borderColor: theme.backgroundElement },
        ]}
      >
        {state === 'loading' ? (
          <ActivityIndicator color={theme.textSecondary} />
        ) : (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
            // Neither fullscreen nor picture-in-picture. Both put a licensed clip
            // on a surface outside the app - PiP literally floats it over other
            // apps - which is the opposite of what the licence asks for.
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one, marginTop: Spacing.two },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slot: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { width: '100%', height: '100%' },
});
