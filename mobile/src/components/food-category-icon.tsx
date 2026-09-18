import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import type { FoodCategory } from '@/lib/food-category';

// The four food icons, drawn (UI brief, 2026-09-17: "category-based illustrated
// icons, not food-specific ... warm, illustrated style consistent with the
// mockup").
//
// DRAWN HERE RATHER THAN TAKEN FROM A SET, for the reason VoiceWaveIcon already
// gives: the app renders SVG for the Health Flower, so a drawing costs no new
// library, no native build and no asset to re-export at every density - and an
// icon set's food glyphs are pictograms of specific dishes, which is exactly
// what the brief rules out.
//
// ONE WEIGHT, ROUND ENDS, NO FILL. They sit in a list at 20px beside 14px text,
// so they are line art at a single stroke width with rounded caps: warm rather
// than technical, and quiet enough that the words stay the thing being read.
//
// The bowl and the cup are the mockup's own two. The plate is the snack, smaller
// and emptier than the bowl on purpose. The leaf is the treat: the mockup uses
// it for the lightest row, and a leaf says "something small" without any of the
// moralising a sweet-specific glyph would carry.

export function FoodCategoryIcon({
  category,
  size = 20,
  color,
}: {
  category: FoodCategory;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const stroke = color ?? theme.textSecondary;
  const common = {
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {category === 'meal' && (
        <>
          {/* A wide shallow bowl: rim, body, and a foot it rests on. */}
          <Path d="M3.2 10.5h17.6" {...common} />
          <Path d="M4.6 10.5c.5 4.3 3.5 7 7.4 7s6.9-2.7 7.4-7" {...common} />
          <Path d="M9.5 17.4v1.6M14.5 17.4v1.6" {...common} />
          {/* Two curls of steam, the only thing on any of these four that moves
              the drawing from object to moment. */}
          <Path d="M10 4.6c-.9.9-.9 1.9 0 2.8M13.9 4.2c-.9.9-.9 1.9 0 2.8" {...common} />
        </>
      )}

      {category === 'drink' && (
        <>
          {/* A cup with a handle, sitting on a saucer line. */}
          <Path d="M5.4 7.2h10.2v5.4a5.1 5.1 0 0 1-10.2 0V7.2Z" {...common} />
          <Path d="M15.8 8.4h1.6a2.2 2.2 0 0 1 0 4.4h-1.6" {...common} />
          <Path d="M4.2 19h13" {...common} />
        </>
      )}

      {category === 'snack' && (
        <>
          {/* A small plate, seen at a slight angle: rim, well, and one crumb of
              a shadow beneath. Emptier than the bowl by design. */}
          <Circle cx="12" cy="12" r="7.4" {...common} />
          <Circle cx="12" cy="12" r="3.6" {...common} />
        </>
      )}

      {category === 'treat' && (
        <>
          {/* A leaf on its stem. Light, and free of any moral about sugar. */}
          <Path d="M18.6 5.4c.6 5.2-2 9.4-7 10-2.4.3-4.3-.9-4.8-3.1-.6-2.7 1.2-5.2 4.3-6.1 2.4-.7 4.9-.8 7.5-.8Z" {...common} />
          <Path d="M5.4 18.6c1.6-2.4 3.7-4.4 6.3-6" {...common} />
        </>
      )}
    </Svg>
  );
}
