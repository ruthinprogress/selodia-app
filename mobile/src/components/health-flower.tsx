import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Text as SvgText } from 'react-native-svg';

import { BrandFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  allDimensionsFull,
  DIMENSION_COLOUR,
  DIMENSION_LABEL,
  DIMENSIONS,
  type Dimension,
  type FlowerCoverage,
} from '@/lib/health-flower';

// The Health Flower.
//
// SIX PETALS, ONE PER DIMENSION, each growing from its outer TIP inward as the
// week's coverage builds. Not filling from the centre like a progress bar: the
// tip is pinned and the oval extends toward the middle, the way a real petal
// opens. They meet at the centre only when all six are tended to.
//
// NO OUTLINES, ANYWHERE. There are no ghost petals showing what is missing,
// because an outline is a scorecard: it tells someone what they failed to do
// before it tells them what they did. A week with three dimensions covered is
// three petals, and that is the whole picture. At 0% nothing renders at all.
//
// THE GEOMETRY IS THE PITCH DOCUMENT'S. Same 220 box, same centre, same
// tip-pinned oval, so the flower in the grant application and the flower in the
// app are the same object rather than two drawings of one idea.
//
//   full petal: ry = 34, tip at 68 from centre, so cy = 42 + ry
//   at P%:      ry = 5 + 29 * P/100, cy = 42 + ry
//
// The 5 is a visible floor rather than a clamp, so growth stays monotonic: a
// clamp would draw 5% and 12% at identical size, and two different weeks must
// never produce the same petal.
//
// rx is tied to ry by the full petal's own aspect ratio rather than held
// constant. Holding it constant makes a low-coverage petal a wide flat blob
// lying across the stem, which is not a petal at any size; tying it keeps every
// petal a proper oval pointing outward, whether it is at 8% or 100%.

const BOX = 220;
const CENTRE = 110;
const FULL_RY = 34;
const FULL_RX = 12;
const TIP_Y = CENTRE - 68; // 42
const ASPECT = FULL_RY / FULL_RX; // ~2.83

// A nonzero petal is never invisible. A strictly proportional oval would be
// under a pixel tall at low coverage, which reads as nothing logged rather than
// as a little logged. So the scale runs from a visible floor up to the full
// petal rather than from zero - which also keeps it MONOTONIC: clamping at a
// floor instead would draw 5% and 12% at exactly the same size, and two
// different weeks must not produce the same petal.
const MIN_VISIBLE_RY = 5;

// Petals overlap where they meet. Slightly translucent so the overlap reads as
// two things meeting rather than one covering the other, which is the whole
// visual argument of the centre.
const PETAL_OPACITY = 0.72;

// THE SEED SITS ON A CREAM DISC, and the mark on it is terracotta.
//
// The first version used assets/images/mark.png, which is CREAM on transparent
// - the app-icon mark, drawn to sit on a dark or terracotta ground. At the
// flower centre it lands on six overlapping pastel petals, and rendering it
// showed exactly what that means: the seed came out a pale ghost rather than an
// arrival. This is the moment the whole feature builds to, so it cannot be the
// faintest thing on the screen.
//
// Terracotta on cream is the treatment the pitch document already uses, so the
// two stay one object rather than drifting. The disc is what makes it legible;
// the mark is what makes it the brand.
const SEED_DISC_R = 21;
const SEED_MARK_R = 17;

function petalFor(coverage: number): { rx: number; ry: number; cy: number } | null {
  if (!Number.isFinite(coverage) || coverage <= 0) return null;
  const pct = Math.min(100, coverage) / 100;
  const ry = MIN_VISIBLE_RY + (FULL_RY - MIN_VISIBLE_RY) * pct;
  return { rx: ry / ASPECT, ry, cy: TIP_Y + ry };
}

// Where each label sits, taken from the pitch document. All of them clear the
// petal tips: the nearest is 12px beyond the tip, so nothing ever touches.
const LABEL_POS: Record<Dimension, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
  strength: { x: 110, y: 30, anchor: 'middle' },
  cardio: { x: 178, y: 70, anchor: 'start' },
  flexibility: { x: 176, y: 162, anchor: 'start' },
  balance: { x: 110, y: 196, anchor: 'middle' },
  bone: { x: 44, y: 162, anchor: 'end' },
  recovery: { x: 42, y: 70, anchor: 'end' },
};

// Where each dimension's touch target sits, and how big it is.
//
// SIX 44pt TARGETS CANNOT FIT AROUND A SMALL CIRCLE. At the petals' own radius
// the spacing between neighbours is about 32pt, so 44pt targets would overlap
// and a tap between two would be a coin toss. Pushed out to 55 units the
// spacing is 50pt, which fits a 49pt target with room to spare.
//
// That radius does two jobs at once: the circle spans radius 28 to 82, which
// covers the outer half of a full petal, the whole of a small one, AND the
// category label sitting at about 80. One target per dimension serves the petal
// and its label together, which is why no second row of labels was added.
//
// CRITICALLY, THESE ARE DRAWN REGARDLESS OF COVERAGE. A dimension at 0% has no
// petal, and that is exactly the dimension somebody is most likely to want to
// look at. The target is there even when the drawing is not.
const HIT_RADIUS_FROM_CENTRE = 55;
const HIT_R = 27;

export function HealthFlower({
  coverage,
  size = 220,
  onSelectDimension,
}: {
  coverage: FlowerCoverage;
  size?: number;
  onSelectDimension?: (d: Dimension) => void;
}) {
  const theme = useTheme();
  const bloomed = allDimensionsFull(coverage);

  // The seed breathes: a slow scale and fade on the whole mark, never a stroke
  // trace. Reduced motion holds it still rather than removing it, because the
  // seed appearing is the meaning and the breathing is only how it arrives.
  const [reduceMotion, setReduceMotion] = useState(false);
  // useState with a lazy initialiser rather than useRef: the value has to be
  // created once and survive re-renders, but reading a ref during render is
  // exactly what the React Compiler rule forbids, and it is right to - a ref
  // read in the render path is a value React cannot see changing.
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        // No answer is not a reason to animate at someone. Stay still.
        if (alive) setReduceMotion(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!bloomed || reduceMotion) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bloomed, reduceMotion, breath]);

  const seedScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });
  const seedOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.62] });
  const seedPx = size * ((SEED_MARK_R * 2) / BOX);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
        {DIMENSIONS.map((d, i) => {
          const p = petalFor(coverage[d]);
          // At 0% no petal renders at all. Not a faint one, not an outline.
          if (!p) return null;
          return (
            <Ellipse
              key={d}
              cx={CENTRE}
              cy={p.cy}
              rx={p.rx}
              ry={p.ry}
              fill={DIMENSION_COLOUR[d]}
              opacity={PETAL_OPACITY}
              // No stroke. Deliberate, and the reason is in the block above.
              transform={`rotate(${i * 60} ${CENTRE} ${CENTRE})`}
            />
          );
        })}

        {/* The cream ground for the seed, drawn inside the SVG so it sits above
            the petals and below the mark. Only when bloomed: an empty disc on
            an unfinished week would be a hole where the seed is going to be,
            which is a promise the flower does not make. */}
        {bloomed && (
          <Circle cx={CENTRE} cy={CENTRE} r={SEED_DISC_R} fill={theme.background} opacity={0.94} />
        )}

        {DIMENSIONS.map((d) => {
          const pos = LABEL_POS[d];
          return (
            <SvgText
              key={`label-${d}`}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              fontFamily={BrandFont.regular}
              fontSize={9}
              fill={theme.textSecondary}
            >
              {DIMENSION_LABEL[d]}
            </SvgText>
          );
        })}
        {/* Touch targets, drawn last so they sit above everything and take the
            tap. Transparent rather than opacity 0: a zero-opacity fill still
            paints, and this must never tint the petal underneath it. */}
        {onSelectDimension &&
          DIMENSIONS.map((d, i) => (
            <Circle
              key={`hit-${d}`}
              cx={CENTRE}
              cy={CENTRE - HIT_RADIUS_FROM_CENTRE}
              r={HIT_R}
              fill="transparent"
              onPress={() => onSelectDimension(d)}
              transform={`rotate(${i * 60} ${CENTRE} ${CENTRE})`}
            />
          ))}
      </Svg>

      {/* The seed, and only when every dimension is genuinely full. Laid over
          the SVG rather than inside it so the breathing can run on the native
          driver, and because the mark is a brand asset that should not be
          redrawn as SVG primitives here and left to drift from the real one. */}
      {bloomed && (
        <Animated.Image
          /* eslint-disable-next-line @typescript-eslint/no-require-imports --
             an ES import of a .png has no type declaration here (expo-env.d.ts
             is generated and not ours to edit), so require is the form that
             actually resolves. Same call the splash and loading icons make. */
          source={require('@/assets/images/mark-terracotta.png')}
          accessibilityLabel="All six dimensions covered this week"
          style={[
            styles.seed,
            {
              width: seedPx,
              height: seedPx,
              marginLeft: -seedPx / 2,
              marginTop: -seedPx / 2,
              opacity: reduceMotion ? 0.95 : seedOpacity,
              transform: reduceMotion ? [] : [{ scale: seedScale }],
            },
          ]}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  seed: { position: 'absolute', left: '50%', top: '50%' },
});
