import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

// THE WATER DROPLET (2026-09-19), from Ruth's brief: a calm droplet that
// "gradually fills", in the watercolour register of the brief's mock-ups. It
// is drawn here as vectors rather than an image because her standing rule is
// no AI illustration - and because a vector can fill to any level, where a set
// of pictures could only step between a few.
//
// The water takes the Balance petal's family of greens, so the droplet reads
// as belonging to the same page as the flower beneath it. Two layers of water
// at slightly different tones and a soft surface curve are what give it the
// painted look; a single flat fill reads as a progress bar.
//
// HOW FULL is decided by the caller (lib/hydration-goal.ts, dropletFill), not
// here: the goal deliberately sits below the brim, and this only draws.

const AnimatedG = Animated.createAnimatedComponent(G);

// The drop, in a 100 x 130 box: a point at the top, a round belly below.
const DROP =
  'M50 5 C50 5 13 57 13 84 A37 37 0 0 0 87 84 C87 57 50 5 50 5 Z';
// Where water can be: the drop's inside spans roughly y 5 (tip) to y 121 (base).
const TOP = 8;
const BOTTOM = 121;

const INK = '#6B6255';
const WATER_LIGHT = '#C3D8D1';
const WATER_DEEP = '#86A89F';

export function WaterDroplet({ fill, size = 56 }: { fill: number; size?: number }) {
  const reduce = useReducedMotion();
  const level = useSharedValue(levelFor(fill));

  useEffect(() => {
    const target = levelFor(fill);
    level.set(
      reduce ? target : withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [fill, reduce, level]);

  const waterProps = useAnimatedProps(() => ({
    transform: [{ translateY: level.get() }],
  }));

  // NO accessible={false} ON THESE SVGs (2026-09-26). react-native-svg passes
  // it straight through to the DOM on web, where `accessible` is not a boolean
  // attribute, so React logs "Received `false` for a non-boolean attribute" -
  // which the app's own error toast then shows over the page. A decorative
  // drawing with no text in it announces nothing to a screen reader anyway, so
  // the prop was buying nothing and costing a warning on every screen that
  // draws one.
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 100 130">
      <Defs>
        <ClipPath id="drop">
          <Path d={DROP} />
        </ClipPath>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={WATER_LIGHT} stopOpacity="0.95" />
          <Stop offset="1" stopColor={WATER_DEEP} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>

      {/* The glass of the drop: the page colour, faintly warmed. */}
      <Path d={DROP} fill="#FBF8F2" />

      <G clipPath="url(#drop)">
        {/* The water, drawn from its surface (y 0) downwards and moved into
            place, so one shape serves every level. */}
        <AnimatedG animatedProps={waterProps}>
          <Path
            d="M-10 4 C 15 -2, 35 9, 55 3 S 95 -1, 110 4 L110 140 L-10 140 Z"
            fill="url(#water)"
          />
          {/* A lighter band just under the surface - the watercolour edge. */}
          <Path
            d="M-10 6 C 18 1, 38 11, 58 6 S 96 2, 110 7 L110 14 C 90 11, 64 16, 40 12 S 5 10, -10 13 Z"
            fill={WATER_LIGHT}
            opacity={0.7}
          />
        </AnimatedG>
        {/* A soft highlight, as though light caught the curve. */}
        <Ellipse cx="34" cy="80" rx="7" ry="14" fill="#FFFFFF" opacity={0.28} />
      </G>

      <Path d={DROP} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    </Svg>
  );
}

// The surface's y for a fill between 0 and 1. Empty sits just below the base,
// so no sliver of water shows at nought.
function levelFor(fill: number): number {
  const f = Math.max(0, Math.min(fill, 1));
  if (f === 0) return BOTTOM + 6;
  return BOTTOM - f * (BOTTOM - TOP);
}
