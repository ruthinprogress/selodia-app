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

import { VoiceHalo } from '@/components/voice-halo';
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
// THE WASH'S OWN COLOURS. Sage for the person, terracotta for Selodía, taken
// from the palette rather than invented: #95A987 and #C97458 are the brand's
// own, and on the dark ground at these opacities they read as ink in water.
// Terracotta on terracotta would disappear, which is why the wash sits far
// lighter than the ground and the mark stays cream.
const SAGE = '#95A987';
// LIGHTER THAN THE BRAND TERRACOTTA, and that is the fix rather than the brand
// being wrong (Ruth, on device: "the terracotta doesn't register as well").
// #C97458 is a mid terracotta and the ground is #834B39, a dark one: the wash
// was the same hue and nearly the same value as the paper it sat on, so it had
// nothing to show against. This is the same hue lifted towards the light, the
// way a wash reads on tinted paper.
const TERRACOTTA = '#EFA684';

// Wide enough that the bloom reaches past the mark on every side without
// touching the screen edges on a small phone.
const HALO = 300;

// Long enough to read as ink drying, short enough that nobody waits for it.
const DISSOLVE_MS = 950;

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
  // THE SCREEN OUTLIVES THE SESSION BY ONE BREATH. "When the conversation ends,
  // the halo slowly dissolves back to the resting seed" - but the session itself
  // ends the moment the seed is tapped, so `visible` goes false immediately and
  // the modal would cut to black mid-wash. So the screen holds itself open for
  // the length of the dissolve and nothing else: no audio, no connection, no
  // state, just the drying of the ink.
  const [shown, setShown] = useState(false);
  const ending = !visible;

  useEffect(() => {
    if (visible) {
      // In a timer rather than straight in the effect body: a synchronous
      // setState here is what the React Compiler rule forbids, and it is right
      // to - it costs a second render pass on every open.
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }
    if (!shown) return;
    const t = setTimeout(() => setShown(false), DISSOLVE_MS);
    return () => clearTimeout(t);
  }, [visible, shown]);

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
    if (!shown || reduceMotion) {
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
  }, [shown, speaking, reduceMotion, pulse]);

  if (!shown) return null;

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [BREATHE_FROM, speaking ? SPEAK_TO : BREATHE_TO],
  });

  // Kept for screen readers, and for them only (UI brief, Part 2, 2026-09-17).
  // The screen itself now says nothing: "listening and speaking states show the
  // Selodía seed mark only ... no glow, no figure, no face". A sentence under
  // the mark is the app narrating itself, and the pulse already says which state
  // this is - slow and small for listening, wider and quicker for speaking.
  const state = connecting ? 'Connecting' : speaking ? 'Selodía is speaking' : 'Listening';

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
        {/* HER DESIGN, 2026-09-18, after looking at how other apps do this:
            "a gently animated seed with a soft translucent halo. No buttons, no
            labels ... a tap on the seed ends the conversation ... like an ink
            wash or watercolour bloom, not a precise circle."

            So the ground keeps its dark terracotta, the wash sits behind the
            mark, and the whole of it is one control. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`${state}. Tap to end the conversation.`}
          accessibilityLiveRegion="polite"
          style={styles.centre}
          hitSlop={Spacing.four}
        >
          <VoiceHalo
            size={HALO}
            speaking={speaking}
            ending={ending}
            sage={SAGE}
            terracotta={TERRACOTTA}
            still={reduceMotion}
          />
          <Animated.View style={[styles.markWrap, { transform: [{ scale }] }]}>
            <Image
              source={MARK}
              style={styles.mark}
              tintColor="#F7F3EA"
              alt=""
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
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
  centre: { alignItems: 'center', justifyContent: 'center' },
  // The mark sits on top of the wash, in the middle of it.
  markWrap: { position: 'absolute' },
  mark: { width: 150, height: 150 },
  // Cream on #834B39 measures 6.26:1 (Part Fifteen).
  state: { color: '#F7F3EA', letterSpacing: 0.3 },
  pressed: { opacity: 0.6 },
});
