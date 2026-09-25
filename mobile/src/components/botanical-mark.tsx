import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// The empty-state drawing (UI brief, Part 2: "botanical line illustration where
// appropriate - no figures").
//
// A sprig: one stem, two open leaves, and a third still furled at the tip. It is
// the Almanac's shoot grown a little - the same idea, which is that the page is
// empty because nothing has grown here YET, not because anybody has fallen
// behind. The furled leaf is drawn faintly for exactly that reason: what exists
// is solid, what is coming is not.
//
// IN SVG, unlike almanac-empty-state.tsx's Shoot. That one is built from rounded
// rectangles because react-native-svg was not a dependency when it was written;
// it is now, for the Health Flower, so this can have real curves. The Almanac
// keeps its own shoot until Ruth says otherwise: it is approved artwork, and
// replacing it quietly is not mine to do.
//
// Sage, never terracotta. Terracotta is reserved for what you can act on, and an
// empty state is not asking for anything.
//
// NOTHING RENDERS THIS YET, and it is kept deliberately rather than deleted as
// dead code (2026-09-26). It is finished artwork waiting on a decision that is
// not mine: the note above says the Almanac keeps its own Shoot until Ruth says
// otherwise, because that one is approved and replacing it quietly is not
// something to do on a Friday night. The settings pages draw a third sprig of
// their own, inline, in sand rather than sage - see settings-page.tsx - so the
// app currently has three botanical drawings and uses two of them.
//
// Flagged to her rather than resolved. Whichever way she goes, two of the three
// should stop existing.

export function BotanicalMark({ size = 72 }: { size?: number }) {
  const theme = useTheme();
  const line = {
    stroke: theme.sage,
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 64 74">
      {/* The stem, leaning very slightly, because nothing in nature is plumb. */}
      <Path d="M32 70c-1.4-14 0-27.6 4-40.8" {...line} />

      {/* Lower left leaf, open. */}
      <Path
        d="M33.6 52c-6.6 1.4-11.8-1.2-14.6-7.6 6.8-2.4 12 .2 14.6 7.6Z"
        {...line}
      />
      {/* Upper right leaf, open and a little larger. */}
      <Path
        d="M35.4 38.6c5.4-3.8 8.2-9.4 7.4-16.6-7 2.2-10.4 7.6-7.4 16.6Z"
        {...line}
      />
      {/* The furled tip: still to come, and drawn as such. */}
      <Path d="M36 29.2c-2.6-4-2.4-8 .6-12 3 3.8 2.8 7.8-.6 12Z" {...line} opacity={0.45} />
    </Svg>
  );
}
