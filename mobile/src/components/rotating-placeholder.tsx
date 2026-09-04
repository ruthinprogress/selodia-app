import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';

import { BrandFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The Chat composer's rotating hint.
//
// WHY IT IS NOT A PLACEHOLDER. React Native's TextInput placeholder is native
// text and cannot be animated - there is no opacity to drive on it. So the real
// placeholder is left empty and this renders over the top of the input,
// absolutely positioned and pointer-events none so every tap still lands on the
// field beneath. It behaves like a placeholder and is not one.
//
// IT STOPS ON TAP AND STAYS STOPPED. Once somebody has touched the composer
// they are using it, and text moving under a cursor they just placed is worse
// than no hint at all. It does not resume on blur either: a hint that starts
// cycling again the moment the keyboard drops would be the same interruption a
// second time.
//
// REDUCED MOTION HOLDS IT ON THE FIRST HINT rather than removing it. The hint
// is the useful part; the cycling is only how the others get a turn.

const HINTS = [
  'Log food, activity, or body data...',
  'Send a photo or describe it...',
  'Type anything, or use + for a photo...',
];

const EVERY_MS = 4000;
const FADE_MS = 320;

export function RotatingPlaceholder({ stopped }: { stopped: boolean }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        if (alive) setReduceMotion(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (stopped || reduceMotion) return;
    const timer = setInterval(() => {
      // Fade out, swap the words while they are invisible, fade back in. The
      // swap happens in the completion callback so the two hints never overlap
      // mid-crossfade and read as one garbled line.
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % HINTS.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [stopped, reduceMotion, opacity]);

  return (
    <Animated.Text
      // Never takes a touch: the input underneath has to receive every tap,
      // including the one that stops this.
      pointerEvents="none"
      // Hidden from screen readers. The TextInput carries its own
      // accessibilityLabel, and a second voice describing the same field would
      // be read out on top of it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      numberOfLines={1}
      style={[styles.hint, { color: theme.textSecondary, opacity: reduceMotion ? 1 : opacity }]}
    >
      {HINTS[index]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: 'absolute',
    // Matches the input's own padding so the hint sits exactly where typed text
    // will appear, rather than near it.
    left: 16,
    right: 16,
    top: 10,
    fontFamily: BrandFont.regular,
    fontSize: 16,
  },
});
