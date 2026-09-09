import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// The screen a voice session lives on.
//
// WHY A WHOLE SCREEN. On device (2026-09-09) the session state was carried by a
// 36pt icon changing colour in the composer, and it was not legible: Ruth could
// not tell listening from paused from off, tapped several times without knowing
// whether anything had happened, and at one point could not tell whether the
// session had ended. A colour change on a small control is not enough signal
// for a mode the whole app is in. This is unmistakable - the screen is either
// terracotta or it is not.
//
// THE GROUND IS #834B39, NOT BRAND TERRACOTTA, and that is a measurement rather
// than a preference. Part Fifteen records cream on #C97458 at 3.10:1 and sand
// at 2.43:1 - both below AA - against 6.26:1 and 4.90:1 on #834B39. The rule it
// states is explicit: on #C97458, the mark and wordmark at display size only,
// never body text at any weight. There is body text here, so the ground is the
// deeper one.
//
// THE MARK RATHER THAN A MICROPHONE. Part Fifteen already specifies a breathing
// pulse on the complete Seed Mark - scale 0.985 to 1.015 over 3.4s - as the
// brand's own loading state, and records that "the asset exists, the app does
// not use it". It does now. A pulsing microphone icon would be a second thing
// to design that says the same thing less well.
//
// THE PULSE CARRIES WHOSE TURN IT IS. Calm and slow while she is listening;
// quicker and wider while Selodia is speaking. That is the one thing a person
// genuinely cannot tell from a silent phone in their pocket, and it costs
// nothing because the SDK already reports the mode.

// Hoisted out of the render so the require sits once, at module scope, rather
// than in the JSX where the lint rule bites and where it would be re-evaluated
// on every frame of the pulse.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('@/assets/images/mark.png');

const BREATHE_MS = 3400; // Part Fifteen's own timing.
const BREATHE_FROM = 0.985;
const BREATHE_TO = 1.015;

// Speaking is deliberately not just "faster breathing" - a wider swing at a
// different rhythm reads as a different state at a glance, where a small speed
// change reads as the same state and leaves you staring at it.
const SPEAK_MS = 900;
const SPEAK_TO = 1.075;

export type VoiceSessionScreenProps = {
  visible: boolean;
  /** True while Selodía is talking; false while she is listening. */
  speaking: boolean;
  /** True between the tap and the session actually connecting. */
  connecting: boolean;
  onClose: () => void;
};

export function VoiceSessionScreen({
  visible,
  speaking,
  connecting,
  onClose,
}: VoiceSessionScreenProps) {
  // useState rather than useRef: an Animated.Value in a ref is read during
  // render by interpolate, which the React Compiler lint rejects. Same reason
  // RotatingPlaceholder and SaveConfirmation hold theirs this way.
  const [pulse] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        // No answer is not a reason to move. The ground colour and the words
        // carry the state on their own, so nothing is lost by holding still.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) =>
      setReduceMotion(on)
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const duration = speaking ? SPEAK_MS : BREATHE_MS;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, speaking, reduceMotion, pulse]);

  if (!visible) return null;

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [BREATHE_FROM, speaking ? SPEAK_TO : BREATHE_TO],
  });

  // Said plainly, because this is the question the old design could not answer.
  const state = connecting ? 'Connecting…' : speaking ? 'Selodía is speaking' : 'Listening';

  return (
    <Modal
      visible
      animationType="fade"
      // Full-screen rather than transparent: the ground IS the signal, and a
      // translucent overlay would leave the app visible underneath, which is
      // exactly the ambiguity this replaces.
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <View style={styles.screen}>
        <View style={styles.centre}>
          <Animated.View style={{ transform: [{ scale }] }}>
            {/* The cream master tinted to sand. Part Fifteen's dark lockup puts
                the mark in sand on this ground specifically - terracotta on
                terracotta would disappear into itself. */}
            <Image
              source={MARK}
              style={styles.mark}
              tintColor="#E9D6C2"
              // Decorative: the state is announced in words below, so a second
              // reading of the same thing would just be noise to a screen reader.
              alt=""
              accessibilityIgnoresInvertColors
            />
          </Animated.View>

          <ThemedText type="small" style={styles.state}>
            {state}
          </ThemedText>
        </View>

        {/* One control, one word, and the same gesture that opened it. The
            long-press-to-end model was replaced on 2026-09-09 after it took
            three to six attempts to register on a real phone. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close voice session"
          hitSlop={Spacing.four}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <ThemedText type="smallBold" style={styles.closeLabel}>
            Done
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Not a theme token: this ground exists only here, and naming it in the
  // palette would invite it onto surfaces where its contrast has not been
  // checked. The value is Part Fifteen's dark ground.
  screen: {
    flex: 1,
    backgroundColor: '#834B39',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  centre: { alignItems: 'center', gap: Spacing.five },
  mark: { width: 168, height: 168 },
  // Cream on #834B39 measures 6.26:1 (Part Fifteen).
  state: { color: '#F7F3EA', letterSpacing: 0.3 },
  close: {
    position: 'absolute',
    bottom: Spacing.six,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: '#E9D6C2',
  },
  closeLabel: { color: '#F7F3EA' },
  pressed: { opacity: 0.6 },
});
