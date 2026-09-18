import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

// THE HALO: light through paper, not a progress ring (Ruth, 2026-09-18, after
// looking at how other apps do voice).
//
// Her design: "a gently animated seed with a soft translucent halo ... when the
// user speaks, the halo is a soft cool sage green pulse. When Selodía speaks,
// the same halo shifts to terracotta, slightly more energetic, but still slow
// and fluid ... like an ink wash or watercolour bloom, not a precise circle ...
// avoid overly digital perfect shapes."
//
// HOW THE BLOOM IS MADE, since none of it is a circle:
//   - Three blobs, each a closed path of four cubic curves with its control
//     points pulled off-centre by different amounts. A circle drawn this way is
//     a circle; these are deliberately not.
//   - Each blob carries a radial gradient that fades to nothing at its own edge,
//     so there is no outline anywhere - the shape ends by running out of ink.
//   - Each breathes on its own clock (5.2s, 6.8s, 4.3s) and sits at its own
//     rotation. Three slow rhythms that never line up read as movement in a
//     fluid; one rhythm reads as a pulse.
//
// COLOUR IS THE ONLY THING THAT SAYS WHO IS SPEAKING. Sage while she talks,
// terracotta while Selodía answers. Both sets are mounted at once and cross-fade
// over 1.1s, which is why they blend rather than switch: at the midpoint both
// are half-present over the same ground, which is exactly the overlap she asked
// for.

const BLOBS = [
  // d, duration, delay, base scale, opacity at rest, rotation
  {
    d: 'M100 14c34 2 74 26 78 66 4 40-24 78-66 84C66 170 24 148 16 108 8 66 44 18 100 14Z',
    duration: 5200,
    scaleTo: 1.1,
    opacity: 0.5,
    rotate: '0deg',
  },
  {
    d: 'M104 20c40 6 72 34 74 74 2 38-30 72-72 76-40 4-76-28-80-70-4-40 32-84 78-80Z',
    duration: 6800,
    scaleTo: 1.16,
    opacity: 0.36,
    rotate: '52deg',
  },
  {
    d: 'M96 26c38-4 76 24 82 62 6 40-26 76-68 80-42 4-78-26-82-66-4-38 28-72 68-76Z',
    duration: 4300,
    scaleTo: 1.06,
    opacity: 0.28,
    rotate: '-38deg',
  },
];

// ONE blob per drawing, because each one has to breathe on its own clock and an
// SVG cannot animate its own paths independently from the outside. The gradient
// id is unique per blob AND per colour: ids live in a document, two layers are
// mounted at once, and a collision would have both washes sharing one tint.
function Bloom({ colour, size, index, idPrefix }: { colour: string; size: number; index: number; idPrefix: string }) {
  const b = BLOBS[index];
  const id = `${idPrefix}-${index}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="46%" r="52%">
          {/* Densest a little off centre, as a wash pools where the brush
              rested rather than in the exact middle, and gone entirely at the
              edge - there is no outline anywhere in this drawing. */}
          <Stop offset="0%" stopColor={colour} stopOpacity={0.55} />
          <Stop offset="55%" stopColor={colour} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={b.d} fill={`url(#${id})`} />
    </Svg>
  );
}

export function VoiceHalo({
  size,
  speaking,
  ending,
  sage,
  terracotta,
  still,
}: {
  size: number;
  /** True while Selodía is talking; false while the person is. */
  speaking: boolean;
  /** True once the session is closing: the wash dries up rather than cutting. */
  ending: boolean;
  sage: string;
  terracotta: string;
  /** Reduce motion: the halo is drawn, and holds. */
  still: boolean;
}) {
  const [breath] = useState(() => BLOBS.map(() => new Animated.Value(0)));
  const [tint] = useState(() => new Animated.Value(0));
  const [presence] = useState(() => new Animated.Value(0));

  // Each blob on its own clock, started once.
  useEffect(() => {
    if (still) return;
    const loops = BLOBS.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath[i], {
            toValue: 1,
            duration: b.duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breath[i], {
            toValue: 0,
            duration: b.duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [breath, still]);

  // Sage to terracotta and back, slowly enough that the change is a shift in the
  // water rather than a switch being thrown.
  useEffect(() => {
    Animated.timing(tint, {
      toValue: speaking ? 1 : 0,
      duration: 1100,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [speaking, tint]);

  // In on arrival, out when the session ends. "The halo slowly dissolves back to
  // the resting seed."
  useEffect(() => {
    Animated.timing(presence, {
      toValue: ending ? 0 : 1,
      duration: ending ? 900 : 1400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [ending, presence]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { width: size, height: size, opacity: presence }]}
    >
      {[
        { colour: sage, opacity: tint.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        { colour: terracotta, opacity: tint },
      ].map((layer, li) => (
        <Animated.View key={li} style={[styles.layer, { opacity: layer.opacity }]}>
          {BLOBS.map((b, i) => (
            <Animated.View
              key={i}
              style={[
                styles.layer,
                {
                  opacity: b.opacity,
                  transform: [
                    { rotate: b.rotate },
                    {
                      scale: still
                        ? 1
                        : breath[i].interpolate({
                            inputRange: [0, 1],
                            // Speaking swings a little wider, as she asked:
                            // "slightly more energetic, but still slow".
                            outputRange: [0.94, b.scaleTo],
                          }),
                    },
                  ],
                },
              ]}
            >
              <Bloom colour={layer.colour} size={size} index={i} idPrefix={li === 0 ? 'sage' : 'terra'} />
            </Animated.View>
          ))}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
