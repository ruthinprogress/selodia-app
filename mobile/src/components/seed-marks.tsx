import Svg, { G, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// THE PAGE WAS NEVER CALLED SETTINGS (Ruth, 24 September 2026).
//
// Three attempts had gone into stopping the word "Settings" losing its s in the
// top-right corner. She looked at the fixes and said the problem was upstream
// of all of them:
//
//   "I think the problem we were trying to solve was confused by calling the
//   page 'Settings'. It's actually not, it holds more than that, including the
//   User Profile and Report Builder ... Really this page is 'more' which is
//   exactly those lovely 3 seeds."
//
// She is right, and it is the better diagnosis. The page holds the profile, the
// connected devices, the privacy choices, the data export and the report
// builder. Half of those are not settings at all, and the corner was hard to
// solve because it was labelled with a word that did not fit what it opened.
//
// So the word goes. Three seeds is the universal "more", drawn in the app's own
// hand rather than borrowed as three dots, and a mark cannot wrap onto a hidden
// second line - which ends that bug by removing its subject rather than by
// patching its symptom for a fourth time.

const stroke = {
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

/**
 * Three seeds, stacked. The way in to everything that is not a tab.
 *
 * Each seed is a pointed oval drawn as two mirrored curves, so the shape has
 * the same soft geometry as the sprig and the Health Flower's petals rather
 * than the hard circles of a standard overflow menu.
 */
export function ThreeSeedsMark({ size = 22, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const line = { ...stroke, stroke: color ?? theme.textSecondary };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 4.2c1.3 1 1.3 2.4 0 3.4-1.3-1-1.3-2.4 0-3.4z" {...line} />
      <Path d="M12 10.3c1.3 1 1.3 2.4 0 3.4-1.3-1-1.3-2.4 0-3.4z" {...line} />
      <Path d="M12 16.4c1.3 1 1.3 2.4 0 3.4-1.3-1-1.3-2.4 0-3.4z" {...line} />
    </Svg>
  );
}

/**
 * A softened figure, for the profile row.
 *
 * Her note beside the options: use the minimal soft glyph for the User Profile.
 * The head is a curve rather than a circle and the shoulders are one open arc,
 * so it belongs beside the sprig and the seed instead of looking like an icon
 * borrowed from a settings app - which is the whole reason the row exists.
 */
export function FigureMark({ size = 20, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const line = { ...stroke, stroke: color ?? theme.textSecondary };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G>
        <Path d="M12 4.5c2 0 3.3 1.5 3.3 3.4S14 11.6 12 11.6 8.7 9.8 8.7 7.9 10 4.5 12 4.5z" {...line} />
        <Path d="M4.8 20c.4-4.3 3.3-6.4 7.2-6.4s6.8 2.1 7.2 6.4" {...line} />
      </G>
    </Svg>
  );
}
