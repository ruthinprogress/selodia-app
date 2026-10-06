import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  AFTER_WELCOME_ROUTE,
  WELCOME,
  WELCOME_REDUCED_MS,
  WELCOME_TIMING,
} from '@/lib/welcome';

// THE MOMENT AT THE END OF SETUP (Ruth, 5 October 2026). Her sequence, in her
// order: the screen fades to terracotta, the seed fades in and gently pulses,
// the two lines arrive, the seed breathes once more, and the app opens on her
// Body Manual.
//
// ---------------------------------------------------------------------------
// THE ANIMATION DOES NOT OWN THE WAY FORWARD, and this is the whole of what
// makes it safe rather than pretty.
//
// A screen that navigates at the end of a timeline strands somebody the first
// time a frame drops, the app is backgrounded mid-sequence, or reduce motion is
// on and the timeline never starts. So:
//
//   1. A PLAIN TIMER OWNS THE EXIT, not the animation's completion callback.
//      Animated.sequence's callback does not fire if the app is backgrounded,
//      and setTimeout does.
//   2. ANY TAP ENDS IT. Said out loud at the bottom, because an undiscoverable
//      escape is not an escape - and because the second time anybody sees this,
//      five seconds is a long time to be held.
//   3. REDUCE MOTION SHOWS EVERYTHING AT ONCE and leaves after a beat. Not
//      nothing: the welcome is the meaning and the breathing is only how it
//      arrives. Holding still forever would be worse than animating at somebody.
//   4. IT CANNOT LEAVE TWICE. `left` guards the exit, because a tap landing a
//      frame before the timer would otherwise fire two navigations.
//
// REPLACE, NOT PUSH. Nothing should be able to come back here with a back
// gesture: setup is over, and returning to a welcome screen reads as the app
// having lost its place.

export default function WelcomeScreen() {
  /**
   * A REPLAY GOES BACK WHERE IT CAME FROM (6 October 2026).
   *
   * Reached from "See the welcome again" in More rather than from Finish. The
   * sequence is identical; only the ending differs, because somebody who asked
   * to look at it has not just finished setup and should not be deposited in the
   * Body Manual as though she had.
   *
   * WHY THE ROW EXISTS AT ALL. I offered "Redo setup replays it" and she chose
   * it, and Redo setup has not existed since 2 October - she had it deleted
   * after it deleted her week. So this shipped unreachable.
   */
  const params = useLocalSearchParams<{ replay?: string }>();
  const replaying = (Array.isArray(params.replay) ? params.replay[0] : params.replay) === '1';

  const [reduceMotion, setReduceMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const left = useRef(false);

  // Three values rather than one, because they move on different schedules and
  // sharing one would make the words fade with the seed's breath.
  const [wash] = useState(() => new Animated.Value(0));
  const [seed] = useState(() => new Animated.Value(0));
  const [words] = useState(() => new Animated.Value(0));
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) {
          setReduceMotion(on);
          setReady(true);
        }
      })
      .catch(() => {
        // No answer is not a reason to animate at somebody. The same choice the
        // Health Flower's seed makes.
        if (alive) {
          setReduceMotion(true);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  function leave() {
    if (left.current) return;
    left.current = true;
    // BACK, NOT ONWARD, FOR A REPLAY. router.back() returns to More; a replace
    // would strand her in the Body Manual with no sense of how she got there.
    if (replaying) {
      router.back();
      return;
    }
    router.replace(AFTER_WELCOME_ROUTE as never);
  }

  useEffect(() => {
    if (!ready) return;

    if (reduceMotion) {
      // Everything at once, held long enough to read, then on.
      wash.setValue(1);
      seed.setValue(1);
      words.setValue(1);
      const t = setTimeout(leave, WELCOME_REDUCED_MS);
      return () => clearTimeout(t);
    }

    const T = WELCOME_TIMING;
    const fade = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const pulse = (duration: number) =>
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

    const score = Animated.sequence([
      fade(wash, T.fadeIn),
      fade(seed, T.seedIn),
      pulse(T.firstPulse),
      fade(words, T.wordsIn),
      pulse(T.secondPulse),
    ]);
    score.start();

    // THE TIMER IS THE ONE THAT LEAVES. See the note above: the animation's own
    // callback does not fire if the app goes to the background mid-sequence, and
    // somebody who switches away for ten seconds should not come back to a
    // welcome screen with no way off it.
    const t = setTimeout(
      leave,
      T.fadeIn + T.seedIn + T.firstPulse + T.wordsIn + T.secondPulse + T.rest
    );
    return () => {
      score.stop();
      clearTimeout(t);
    };
    // `leave` is stable for the life of the screen: it guards on a ref and the
    // route is a constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reduceMotion]);

  const seedScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });

  return (
    <Pressable
      onPress={leave}
      accessibilityRole="button"
      accessibilityLabel={`${WELCOME.title}. ${WELCOME.line}. ${WELCOME.skip}`}
      style={styles.fill}>
      {/* THE GROUND IS DRAWN, NOT THEMED. This screen is one deliberate colour in
          both themes: it is a moment rather than a surface, and a welcome that
          arrives cream in the morning and terracotta at night is two different
          moments. Her word was terracotta. */}
      <Animated.View style={[styles.fill, styles.wash, { opacity: wash }]} />
      <View style={styles.centre}>
        <Animated.View style={{ opacity: seed, transform: [{ scale: seedScale }] }}>
          <Image
            source={require('../../../assets/images/mark.png')}
            style={styles.seed}
            contentFit="contain"
            // The mark carries the meaning and the words say it too, so it is
            // decorative to a screen reader rather than a second announcement.
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>
        <Animated.View style={[styles.titleBlock, { opacity: words }]}>
          {/* ONE Text PER LINE, NEVER A WRAP. Her screenshot showed "Welcome to"
              with the name missing entirely: it was measured, given its space,
              and never drawn. Third time Android has done this here, so nothing
              on this screen asks it to work out where a line ends. */}
          {WELCOME.titleLines.map((line) => (
            <ThemedText key={line} type="display" style={styles.title}>
              {line}
            </ThemedText>
          ))}
          <View style={styles.lineBlock}>
            {WELCOME.lineParts.map((part) => (
              <ThemedText key={part} type="small" style={styles.line}>
                {part}
              </ThemedText>
            ))}
          </View>
        </Animated.View>
      </View>
      <Animated.View style={[styles.footer, { opacity: words }]}>
        <ThemedText type="small" style={styles.skip}>
          {WELCOME.skip}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const TERRACOTTA = '#C97458';
const ON_TERRACOTTA = '#F7F3EA';

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  wash: { backgroundColor: TERRACOTTA },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // THE THREE BLOCKS: the seed, the name, the tagline. Spaced here rather than
  // by padding on the text, so adding a line to any of them changes nothing.
  titleBlock: { alignItems: 'center', paddingTop: Spacing.five },
  lineBlock: { alignItems: 'center', paddingTop: Spacing.four },
  seed: { width: 96, height: 96 },
  title: { color: ON_TERRACOTTA, textAlign: 'center' },
  // NO TOP PADDING. The tagline is two Texts now, and padding on each would open
  // a gap in the middle of one sentence.
  line: { color: ON_TERRACOTTA, textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: Spacing.six, alignItems: 'center' },
  skip: { color: ON_TERRACOTTA, opacity: 0.7 },
});
