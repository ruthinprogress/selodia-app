import Svg, { Ellipse, Path } from 'react-native-svg';

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

export type MeasurementIconKind = 'chest' | 'waist' | 'hips' | 'thigh' | 'arm' | 'calf' | 'neck' | 'tape';

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
