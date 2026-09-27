import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';

import { BodyFont } from '@/constants/theme';
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

// SHORT ENOUGH TO FIT THE FIELD THEY SIT IN. These read as "Log food, acti…" on
// a real phone on 2026-09-16, and the field got narrower the same day when Send
// moved inside the box. A hint that gets cut off teaches the wrong thing about
// the field twice over - it looks broken, and it stops naming the third option.
// ONE HINT, NOT THREE (Ruth, 27 September 2026): "the chat input placeholder
// switches between 'Type anything...' and 'Log food or activity...'. Pick one;
// 'Type anything...' fits better."
//
// She is right, and the reason is worth keeping. A rotating hint teaches the
// field by listing what it accepts, which is what you do when a field accepts a
// FEW things. This one accepts anything, so the list was undercutting the
// message: naming food and activity makes somebody wonder whether a question
// about their knee belongs here. "Type anything" says the true thing, and the
// photo button is visible beside the field anyway.
//
// It also said "activity" where the whole app now says "movement", which had
// been true since the Plans tab took that word on 20 September.
//
// The rotation machinery below is kept rather than torn out: it costs one array
// entry and nothing else, and the day a second hint earns its place it is one
// line. Nothing rotates with a single hint.
const HINTS = ['Type anything...'];

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
    // will appear, rather than near it. (The composer became a column on
    // 2026-09-18 and the field's padding came down with it.)
    left: 8,
    right: 8,
    top: 10,
    fontFamily: BodyFont.regular,
    fontSize: 16,
  },
});
