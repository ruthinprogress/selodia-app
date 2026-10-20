import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Text as SvgText } from 'react-native-svg';

import { BodyFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  allDimensionsFull,
  DIMENSION_COLOUR,
  DIMENSION_DEEP,
  DIMENSION_LABEL,
  DIMENSIONS,
  type Dimension,
  type FlowerCoverage,
} from '@/lib/health-flower';
// THE SHAPE, FROM ONE PLACE. These were declared in this file until 20 October
// 2026, when the report gained a flower of its own: the server renders HTML and
// cannot import a React Native component, so the measurements moved somewhere
// both halves can read. See flower-geometry.ts.
import {
  BOX,
  CENTRE,
  PETAL_OPACITY,
  RING_OPACITY,
  TIP_RING_R,
  VIEW_W,
  VIEW_X,
  petalFor,
} from '@/lib/flower-geometry';

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
// THE LABELS WERE THE SMALLEST TEXT IN THE APP BY A LONG WAY (2026-09-25).
//
// One unit of this drawing renders at size/220 points, so on Today - where the
// flower is 195 - a 9-unit label arrived at about 8 points on the glass. The
// app's own floor is 12 (`detail` in themed-text.tsx), and this is an app whose
// whole audience is women over forty; it has already rejected a 4.39:1 contrast
// as too low for that reader. Eight-point type is the same mistake wearing a
// different face, and nobody caught it because the flower is looked at as a
// drawing rather than read.
//
// 13.5 units renders at 12 on Today and 13.5 on the Almanac, where the flower
// is drawn at its full 220. The floor, not a compromise with it.
const LABEL_SIZE = 13.5;

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

// Where each label sits, taken from the approved design. The tips moved 4 units
// further out, so every label moved out with them, and all still clear the tips.
//
// TWO DELIBERATE DIFFERENCES FROM THE DECK: colour and size. The deck sets
// labels at 8pt in #9C948A, which is under 3:1 on cream and fails AA for text.
// The app now sets them at 13.5 units in each petal's own deep tone - see
// LABEL_SIZE and the fill below. The approval was for the bloom, and a label
// nobody can read is not part of it.
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

        {/* THE RING: where every petal STARTS (Ruth, 2026-09-16).

            It was added as a horizon, with the worry that it might read as a
            target once real petals appeared. Ruth settled that: "the petals
            move from the outside in, so actually they are a starting point,
            not a target". The tip is pinned at this radius and the oval grows
            INWARD, so a gauge's logic is inverted here - a gauge fills toward
            its edge, and this one empties away from it. A circle every petal
            moves off cannot be a thing to fill.

            One continuous hairline, no segments and no ticks, so there is
            nothing per-dimension to read as an unfilled slot either. Behind
            everything, so a petal always covers it rather than sitting in it. */}
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={TIP_RING_R}
          fill="none"
          stroke={theme.sage}
          strokeWidth={1}
          opacity={RING_OPACITY}
        />

        {/* The terracotta ground for the seed, drawn inside the SVG so it sits
            above the petals and below the mark.

            FROM DAY ONE, not only at full bloom (Ruth, 2026-09-16: it "looks
            like it's broken unless it got data to populate it"). At zero
            coverage no petal renders, so the old rule left six labels around
            empty space - a drawing with its subject missing, which is the first
            thing a new user ever sees. The seed is the brand's own image for
            "not yet", and it is what the Almanac's shoot illustration already
            says. The earlier reasoning - that a disc on an unfinished week is "a
            hole where the seed is going to be" - was written when the seed was
            the reward for a full week; the reward is now the bloom around it. */}
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={SEED_DISC_R}
          fill={theme.accent}
          opacity={SEED_DISC_OPACITY}
        />

        {DIMENSIONS.map((d) => {
          const pos = LABEL_POS[d];
          return (
            <SvgText
              key={`label-${d}`}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              /* THE BODY FACE, NOT THE DISPLAY ONE, and it was close. The
                 serif would say "illustration" harder, which is the note this
                 change answers - but at 12 points the serif's smaller x-height
                 costs real legibility, and this reader is the whole reason the
                 size went up in the first place. The colour below does the
                 work the face would have done. */
              fontFamily={BodyFont.regular}
              fontSize={LABEL_SIZE}
              /* EACH WORD IN ITS OWN PETAL'S COLOUR (Ruth, 25 September 2026:
                 the wheel should feel "less like a chart and more like an
                 illustration of balance").

                 The petals were never the chart-like part. Six grey words set
                 in the body face, evenly spaced around a circle, is the visual
                 grammar of a radar plot's axis labels - and that is what a
                 reader recognises first, before any of the reasoning about
                 inward-growing petals and starting rings gets a chance.

                 In its petal's colour each word belongs to the thing it names,
                 which is a botanical plate rather than a plot. DIMENSION_DEEP
                 rather than the petal colour itself: those are the same six
                 hues darkened until cream clears 5.5:1 on them, and contrast
                 is symmetric, so every one of them also clears 5.5:1 AS text on
                 this cream. Measured once, for the buttons, and true here for
                 the same reason. */
              fill={DIMENSION_DEEP[d]}
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

      {/* The seed mark, now drawn always. Laid over the SVG rather than inside
          it so the breathing can run on the native driver, and because the mark
          is a brand asset that should not be redrawn as SVG primitives here and
          left to drift from the real one.

          THE BREATHING STILL BELONGS TO THE BLOOM. `bloomed` gates the
          animation, not the drawing: an empty flower shows a still seed, and
          only a full week makes it breathe. A pulse at somebody who has logged
          nothing would be the app asking for something, which is the opposite
          of what this screen is for. */}
      <Animated.Image
          /* eslint-disable-next-line @typescript-eslint/no-require-imports --
             an ES import of a .png has no type declaration here (expo-env.d.ts
             is generated and not ours to edit), so require is the form that
             actually resolves. Same call the splash and loading icons make. */
        source={require('@/assets/images/mark.png')}
        // The label follows the drawing, not the asset: the seed means "all six
        // covered" only when it is, and says nothing the rest of the time
        // rather than announcing a week that has not happened.
        accessibilityLabel={bloomed ? 'All six dimensions covered this week' : undefined}
        accessibilityElementsHidden={!bloomed}
        importantForAccessibility={bloomed ? 'yes' : 'no-hide-descendants'}
        style={[
          styles.seed,
          {
            width: seedPx,
            height: seedPx,
            marginLeft: -seedPx / 2,
            marginTop: -seedPx / 2,
            opacity: reduceMotion || !bloomed ? 0.95 : seedOpacity,
            transform: reduceMotion || !bloomed ? [] : [{ scale: seedScale }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  seed: { position: 'absolute', left: '50%', top: '50%' },
});
