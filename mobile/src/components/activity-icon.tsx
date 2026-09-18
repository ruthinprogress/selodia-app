import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import type { ActivityIconKind } from '@/lib/activity-icon';

// The movement icons (UI brief, Part 2: "soft line-drawn movement icons per
// activity type ... refine to match the illustrated style").
//
// DRAWN, LIKE THE FOOD ONES, and for the same reasons: the app already renders
// SVG, so a drawing costs no new library and no asset to re-export; and an icon
// set's fitness glyphs are gym pictograms, which is the wrong register for a
// brand whose whole argument is that this is not a fitness app.
//
// FIGURES ARE ALLOWED HERE, AND THE BRIEF'S RULE IS NOT BREACHED. "Do not add
// female figures anywhere - no aspirational archetypes" is about illustration:
// a drawn woman doing yoga on a mat is an aspirational image of a body. These
// are marks, not people: a head, a stroke for a spine, two for the legs, at
// 20px, with no shape, no gender and nothing to compare yourself to. The
// mockup's own activity log carries exactly these.
//
// One stroke weight, round ends, no fill. They live in a list beside 14px text.

export function ActivityIcon({
  kind,
  size = 20,
  color,
}: {
  kind: ActivityIconKind;
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

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'walk' && (
        <>
          <Circle cx="13.6" cy="4.4" r="1.7" {...line} />
          <Path d="M13 7.6 11 12l2.6 2 .9 5" {...line} />
          <Path d="M11 12l-2.2 3.4L7.4 19" {...line} />
          <Path d="M13 8.6l3 1.6" {...line} />
        </>
      )}

      {kind === 'run' && (
        <>
          <Circle cx="15.4" cy="4.3" r="1.7" {...line} />
          <Path d="M15.2 7.4 11.6 10l1.8 3.2-1 5.4" {...line} />
          <Path d="M11.6 10 7.8 11.2 6.4 15" {...line} />
          <Path d="M13.4 8.2l3.8 1.2 1.6 3" {...line} />
        </>
      )}

      {kind === 'yoga' && (
        <>
          {/* Seated, legs crossed: a head above a wide, calm base. */}
          <Circle cx="12" cy="5" r="1.8" {...line} />
          <Path d="M12 7.2v5" {...line} />
          <Path d="M5.6 17.6c2-2.2 4-3.3 6.4-3.3s4.4 1.1 6.4 3.3" {...line} />
          <Path d="M6.4 12.6c1.8 1.2 3.6 1.8 5.6 1.8s3.8-.6 5.6-1.8" {...line} />
        </>
      )}

      {kind === 'dance' && (
        <>
          <Circle cx="12.8" cy="4.2" r="1.7" {...line} />
          <Path d="M12.6 7.2 11 11.4l2.6 2.2.6 5" {...line} />
          <Path d="M11 11.4 8 14.4l-.6 4.4" {...line} />
          <Path d="M12.3 8.4 16 6.2M12.3 9.4l3.4 3" {...line} />
        </>
      )}

      {kind === 'strength' && (
        <>
          {/* A dumbbell, seen from the side. */}
          <Path d="M8.4 12h7.2" {...line} />
          <Path d="M6.6 9.2v5.6M17.4 9.2v5.6" {...line} />
          <Path d="M4.4 10.6v2.8M19.6 10.6v2.8" {...line} />
        </>
      )}

      {kind === 'cycle' && (
        <>
          <Circle cx="5.8" cy="16.2" r="3.4" {...line} />
          <Circle cx="18.2" cy="16.2" r="3.4" {...line} />
          <Path d="m5.8 16.2 4-6.4h5l-3 6.4" {...line} />
          <Path d="M13 9.8 11.6 6.4h2.8" {...line} />
        </>
      )}

      {kind === 'swim' && (
        <>
          <Circle cx="16.6" cy="7.4" r="1.6" {...line} />
          <Path d="M4.4 12.6c2.4-1.8 4.6-1.8 6.6 0 1.6-2 3.4-3 5.4-3" {...line} />
          <Path d="M3.6 17.2c1.8-1.4 3.4-1.4 4.8 0 1.4 1.4 3 1.4 4.4 0 1.4-1.4 3-1.4 4.4 0" {...line} />
        </>
      )}

      {kind === 'climb' && (
        <>
          {/* A wall with holds, not a person on one. */}
          <Path d="M4.6 19.4 12 4.6l7.4 14.8" {...line} />
          <Circle cx="10.4" cy="12.4" r="1" {...line} />
          <Circle cx="14" cy="15.6" r="1" {...line} />
          <Circle cx="9" cy="16.8" r="1" {...line} />
        </>
      )}

      {kind === 'stretch' && (
        <>
          {/* A long reach: a spine bending over a straight leg. */}
          <Circle cx="7" cy="7.4" r="1.7" {...line} />
          <Path d="M7.6 9.6c1.4 2.2 3.2 3.6 5.4 4.2" {...line} />
          <Path d="M13 13.8h5.8" {...line} />
          <Path d="M6.2 18.4h8" {...line} />
        </>
      )}

      {kind === 'movement' && (
        <>
          {/* The plain mark for anything unrecognised: a movement, not a sport. */}
          <Path d="M4.6 15.4c2.6-4.6 5-6.9 7.4-6.9s4.8 2.3 7.4 6.9" {...line} />
          <Circle cx="12" cy="5.4" r="1.6" {...line} />
        </>
      )}
    </Svg>
  );
}
