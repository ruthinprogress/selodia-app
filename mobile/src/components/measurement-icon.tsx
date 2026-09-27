import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// The tape-measure icons (UI brief, Part 2: "body outline icons for thigh and
// waist - functional, not decorative").
//
// FUNCTIONAL IS THE WHOLE INSTRUCTION. Each one is the same drawing - an outline
// and a band across it - with the band where the tape actually goes. It tells
// somebody which measurement a row is, at a glance, and says nothing whatever
// about what a body should look like: no waist, no curve, no silhouette. The
// torso is a rounded column, the limb is a rounded tube, and the only thing that
// changes between them is the height of the line.
//
// Anything without a placement gets the plain tape mark rather than a body part
// guessed from a name somebody typed.

export type MeasurementIconKind =
  | 'chest'
  | 'waist'
  | 'hips'
  | 'thigh'
  | 'arm'
  | 'calf'
  | 'neck'
  | 'tape'
  // THE THREE A SCALE GIVES (Ruth, 26 September 2026: "yes, draw three in the
  // same family as the tape marks").
  //
  // They needed different thinking from the rest of the family, and it is worth
  // saying why. Every mark above works because the band sits WHERE THE TAPE
  // ACTUALLY GOES - that is what makes chest, waist and hips legible as the
  // same drawing three times. Weight, body fat and muscle have no placement on
  // a body at all, so copying that trick would put a band at an invented
  // height and mean nothing.
  //
  // So weight is the OBJECT: a set of scales, seen from above, with its feet.
  // Unambiguous, and it is the thing she actually steps on.
  //
  // Body fat and muscle are PROPORTIONS - a part of a whole - drawn as a ring
  // with a level in it, low and high. That is deliberately not a body and
  // deliberately not a verdict: principle 16 rules out depicting bodies, and a
  // body-fat icon that hints at a shape would be the app having an opinion
  // about one. A level in a vessel says "some of the whole" and stops there.
  | 'weight'
  | 'body_fat'
  | 'muscle';

export function measurementIcon(metricName: string | null | undefined): MeasurementIconKind {
  const n = (metricName ?? '').toLowerCase();
  if (/chest|bust|under ?bust/.test(n)) return 'chest';
  if (/waist|tummy|stomach|belly|abdomen/.test(n)) return 'waist';
  if (/hip|glute|bum|seat/.test(n)) return 'hips';
  if (/thigh|quad|leg(?! press)/.test(n)) return 'thigh';
  if (/arm|bicep|tricep/.test(n)) return 'arm';
  if (/calf|calves|ankle/.test(n)) return 'calf';
  if (/neck/.test(n)) return 'neck';
  return 'tape';
}

// Where the band sits on the torso, as a y in the 24-unit box.
const TORSO_BAND: Partial<Record<MeasurementIconKind, number>> = {
  chest: 9.4,
  waist: 12.6,
  hips: 15.8,
};

// Where it sits on a limb.
const LIMB_BAND: Partial<Record<MeasurementIconKind, number>> = {
  thigh: 9.8,
  arm: 10.6,
  calf: 15.4,
};

export function MeasurementIcon({
  kind,
  size = 20,
  color,
}: {
  kind: MeasurementIconKind;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const stroke = color ?? theme.textSecondary;
  const line = {
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const torsoY = TORSO_BAND[kind];
  const limbY = LIMB_BAND[kind];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {torsoY != null && (
        <>
          {/* A torso as a column: shoulders, sides, hips. No waist drawn in. */}
          <Path d="M8 4.6h8" {...line} />
          <Path d="M8 4.6c-.7 4.4-.9 9.4-.5 14.8h9c.4-5.4.2-10.4-.5-14.8" {...line} />
          <Path d={`M5.8 ${torsoY}h12.4`} {...line} />
        </>
      )}

      {limbY != null && (
        <>
          {/* A limb as a tube. Same drawing for arm, thigh and calf; only the
              band moves, which is exactly the difference between them. */}
          <Path d="M9 4.2c-.6 5-.6 10.6 0 15.6h6c.6-5 .6-10.6 0-15.6" {...line} />
          <Path d={`M6.6 ${limbY}h10.8`} {...line} />
        </>
      )}

      {kind === 'neck' && (
        <>
          <Path d="M9.4 4.4v5.2c0 1.6-1.2 2.6-3 3.2M14.6 4.4v5.2c0 1.6 1.2 2.6 3 3.2" {...line} />
          <Path d="M6.2 10.4h11.6" {...line} />
        </>
      )}

      {kind === 'weight' && (
        <>
          {/* A set of scales from above: the plate, the display, the feet. */}
          <Rect x="4.5" y="5.5" width="15" height="13" rx="3" {...line} />
          <Path d="M7 12h10" {...line} />
          <Path d="M8 18.5v2M16 18.5v2" {...line} />
        </>
      )}

      {(kind === 'body_fat' || kind === 'muscle') && (
        <>
          {/* A whole, with a level in it. The level is the only difference
              between the two, which is the same economy the torso marks use -
              one drawing, one thing moving. */}
          <Circle cx="12" cy="12" r="7.5" {...line} />
          <Path
            d={kind === 'body_fat' ? 'M5.1 15a7.5 7.5 0 0 0 13.8 0' : 'M4.9 9.2a7.5 7.5 0 0 0 14.2 0'}
            {...line}
          />
        </>
      )}

      {kind === 'tape' && (
        <>
          {/* A tape measure's own loop, for a metric with no body placement. */}
          <Ellipse cx="12" cy="12" rx="7.6" ry="5.2" {...line} />
          <Path d="M8.6 12h6.8" {...line} />
        </>
      )}
    </Svg>
  );
}
