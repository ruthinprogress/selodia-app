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
// opens. When all six are tended to they run past the centre and overlap there.
//
// NO OUTLINES, ANYWHERE. There are no ghost petals showing what is missing,
// because an outline is a scorecard: it tells someone what they failed to do
// before it tells them what they did. A week with three dimensions covered is
// three petals, and that is the whole picture. At 0% nothing renders at all.
//
// THE GEOMETRY IS THE APPROVED DESIGN'S (Ruth, 11 September; confirmed on 12
// September as the fix for the flower's "render bug"). It is the same drawing the
// ElevenLabs deck carries, so the flower in the deck and the flower in the app
// are one object rather than two drawings of one idea. Taken from
// `2026-09-11 Health Flower approved, in balance.svg` and its part-way sibling in
// Build Specs/Branding & Assets/Visual Assets.
//
//   full petal: ry = 38, tip at 72 from centre, so cy = 38 + ry
//   at P%:      ry = 5 + 33 * P/100, cy = 38 + ry
//
// A full petal runs from 72 out to 4 past the centre, which is what makes the six
// overlap there like a Venn diagram. The previous geometry (12 x 34, tip at 68)
// stopped exactly at the centre, so full petals only touched.
//
// The 5 is a visible floor rather than a clamp, so growth stays monotonic: a
// clamp would draw 5% and 12% at identical size, and two different weeks must
// never produce the same petal.
//
// rx is tied to ry by the full petal's own aspect ratio rather than held
// constant. Holding it constant makes a low-coverage petal a wide flat blob
// lying across the stem, which is not a petal at any size; tying it keeps every
// petal a proper oval pointing outward, whether it is at 8% or 100%. The
// approved part-way file follows the same rule (rx = ry / 3.8 throughout).

const BOX = 220;
const CENTRE = 110;
const FULL_RY = 38;
const FULL_RX = 10;
const TIP_Y = CENTRE - 72; // 38
const ASPECT = FULL_RY / FULL_RX; // 3.8

// The labels sit wider than the 220 square, so the drawing gets 26 units of
// margin either side, as the approved file does. The centre stays at 110, the
// midpoint of -26..246, which is what keeps the seed overlay (positioned at 50%
// of the wrapper) exactly on the flower's centre.
const VIEW_X = -26;
const VIEW_W = 272;

// A nonzero petal is never invisible. A strictly proportional oval would be
// under a pixel tall at low coverage, which reads as nothing logged rather than
// as a little logged. So the scale runs from a visible floor up to the full
// petal rather than from zero - which also keeps it MONOTONIC: clamping at a
// floor instead would draw 5% and 12% at exactly the same size, and two
// different weeks must not produce the same petal.
const MIN_VISIBLE_RY = 5;

// Petals overlap at the centre, and at half opacity, as approved, so where two
// meet their colours mix rather than one covering the other. That mixing is the
// whole visual argument of the centre: the dimensions are not separate numbers.
const PETAL_OPACITY = 0.5;

// THE SEED: the cream mark on a translucent terracotta disc, as approved.
//
// It has changed twice, and the history is the reason for the current values.
// The first version put the cream mark straight onto the petals, and it came out
// a pale ghost on six overlapping pastels. The second put a terracotta mark on a
// cream disc, which read clearly but sat ON the flower rather than in it. The
// approved design keeps the cream mark and gives it a terracotta ground at 38%:
// enough contrast for the mark to arrive, while the petals still show through the
// disc, so the seed belongs to the bloom.
const SEED_DISC_R = 12;
const SEED_DISC_OPACITY = 0.38;
const SEED_MARK_R = 8;

function petalFor(coverage: number): { rx: number; ry: number; cy: number } | null {
  if (!Number.isFinite(coverage) || coverage <= 0) return null;
  const pct = Math.min(100, coverage) / 100;
  const ry = MIN_VISIBLE_RY + (FULL_RY - MIN_VISIBLE_RY) * pct;
  return { rx: ry / ASPECT, ry, cy: TIP_Y + ry };
}

// Where each label sits, taken from the approved design. The tips moved 4 units
// further out, so every label moved out with them, and all still clear the tips.
//
// ONE DELIBERATE DIFFERENCE FROM THE DECK: colour and size. The deck sets labels
// at 8pt in #9C948A, which is under 3:1 on cream and fails AA for text. The app
// keeps textSecondary at 9, which passes; the approval was for the bloom, and a
// label nobody can read is not part of it.
const LABEL_POS: Record<Dimension, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
  strength: { x: 110, y: 24, anchor: 'middle' },
  cardio: { x: 182, y: 66, anchor: 'start' },
  flexibility: { x: 180, y: 164, anchor: 'start' },
  balance: { x: 110, y: 204, anchor: 'middle' },
  bone: { x: 40, y: 164, anchor: 'end' },
  recovery: { x: 38, y: 66, anchor: 'end' },
};

// Where each dimension's touch target sits, and how big it is.
//
// SIX 44pt TARGETS CANNOT FIT AROUND A SMALL CIRCLE. At the petals' own radius
// neighbours are too close, so 44pt targets would overlap and a tap between two
// would be a coin toss. At 58 units out the spacing between neighbours is 58pt,
// which fits a 54pt target with room to spare.
//
// That radius does two jobs at once: each circle spans 31 to 85 from the centre,
// which covers the outer half of a full petal, the whole of a small one, AND the
// category label sitting at about 86. One target per dimension serves the petal
// and its label together, which is why no second row of labels was added. It
// moved out from 55 when the tips did.
//
// CRITICALLY, THESE ARE DRAWN REGARDLESS OF COVERAGE. A dimension at 0% has no
// petal, and that is exactly the dimension somebody is most likely to want to
// look at. The target is there even when the drawing is not.
const HIT_RADIUS_FROM_CENTRE = 58;
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
  // One unit of the drawing is size / BOX points on BOTH axes: the height maps
  // 220 units to `size`, and the width maps 272 units to size * 272 / 220.
  const width = (size * VIEW_W) / BOX;
  const seedPx = size * ((SEED_MARK_R * 2) / BOX);

  return (
    <View style={[styles.wrap, { width, height: size }]}>
      <Svg width={width} height={size} viewBox={`${VIEW_X} 0 ${VIEW_W} ${BOX}`}>
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

        {/* The terracotta ground for the seed, drawn inside the SVG so it sits
            above the petals and below the mark. Only when bloomed: an empty disc
            on an unfinished week would be a hole where the seed is going to be,
            which is a promise the flower does not make. */}
        {bloomed && (
          <Circle
            cx={CENTRE}
            cy={CENTRE}
            r={SEED_DISC_R}
            fill={theme.accent}
            opacity={SEED_DISC_OPACITY}
          />
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
          source={require('@/assets/images/mark.png')}
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
