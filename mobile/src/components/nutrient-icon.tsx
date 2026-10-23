import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import type { MacroKey } from '@/lib/tracked-macros';

// THE NUTRIENT MARKS, IN THE HOUSE STYLE (Ruth, 22 October 2026).
//
//   "icons are inconsistent and not on brand - worth getting Chatgpt to make a
//    set here? And you copy them into custom SVG files?"
//
// She was right about the inconsistency and the app already answers the second
// question. There is a house style here and three sets already drawn in it -
// measurement-icon.tsx, drink-icons.tsx, food-category-icon.tsx:
//
//   a 24-square, no fills, 1.4 stroke, round caps and joins, one colour passed
//   in from the theme.
//
// What was on this screen instead was ten Material glyphs chosen one at a time,
// which is why they did not sit together: a sun, a laboratory molecule diagram,
// a droplet, a droplet with a percent sign in it, a stalk of barley and a
// salt cellar are five different drawing languages, and no amount of tinting
// makes them one.
//
// SO THESE JOIN THE SET RATHER THAN STARTING ANOTHER ONE. Nothing was
// commissioned: these are simple enough shapes that a round trip would only add
// a chance for the stroke weight to drift. check-nutrient-icons holds the grid,
// the weight and the no-fill rule, so a later addition cannot quietly be the
// odd one out again.
//
// WHERE TWO MARKS ARE DELIBERATELY ALIKE. Fat is a drop and saturated fat is
// the same drop with a band across it, because saturated fat IS a kind of fat -
// the card nests one under the other for the same reason. Iron is not a third
// drop: it is a red cell seen face on, which is where the iron in food ends up
// and the one thing that distinguishes it from the fats at a glance.

export type NutrientIconProps = {
  macroKey: MacroKey;
  size?: number;
  color?: string;
};

/** The drop, shared by fat and saturated fat. */
const DROP = 'M12 3.4C12 3.4 6.2 10.4 6.2 14.6A5.8 5.8 0 0 0 17.8 14.6C17.8 10.4 12 3.4 12 3.4Z';

export function NutrientIcon({ macroKey, size = 20, color }: NutrientIconProps) {
  const theme = useTheme();
  const stroke = color ?? theme.textSecondary;
  // The house line, lifted from measurement-icon.tsx rather than re-chosen.
  const line = {
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {macroKey === 'kcal' && (
        <>
          {/* Energy: a sun, because calories are not a food and every other
              mark here is a thing you can hold. */}
          <Circle cx="12" cy="12" r="4.2" {...line} />
          <Path d="M12 2.6V4.8M12 19.2V21.4M2.6 12H4.8M19.2 12H21.4" {...line} />
          <Path d="M5.4 5.4L7 7M17 17L18.6 18.6M18.6 5.4L17 7M5.4 18.6L7 17" {...line} />
        </>
      )}

      {macroKey === 'protein' && (
        <>
          {/* Three linked units: the shape of a protein without pretending to
              be a particular one. */}
          <Circle cx="12" cy="5.6" r="2.4" {...line} />
          <Circle cx="6.4" cy="16.2" r="2.4" {...line} />
          <Circle cx="17.6" cy="16.2" r="2.4" {...line} />
          <Path d="M10.9 7.7L7.5 14.1M13.1 7.7L16.5 14.1M8.8 16.2H15.2" {...line} />
        </>
      )}

      {macroKey === 'fat' && <Path d={DROP} {...line} />}

      {macroKey === 'saturated' && (
        <>
          <Path d={DROP} {...line} />
          {/* The band says "one kind of", which is what the row says in words. */}
          <Path d="M7.6 14.8H16.4" {...line} />
        </>
      )}

      {macroKey === 'carbs' && (
        <>
          {/* A grain head: the stalk and three pairs. */}
          <Path d="M12 21V8.4" {...line} />
          <Path d="M12 9.2C10 9.2 8.4 10.6 8.4 12.6C10.4 12.6 12 11.2 12 9.2Z" {...line} />
          <Path d="M12 9.2C14 9.2 15.6 10.6 15.6 12.6C13.6 12.6 12 11.2 12 9.2Z" {...line} />
          <Path d="M12 13.4C10 13.4 8.4 14.8 8.4 16.8C10.4 16.8 12 15.4 12 13.4Z" {...line} />
          <Path d="M12 13.4C14 13.4 15.6 14.8 15.6 16.8C13.6 16.8 12 15.4 12 13.4Z" {...line} />
          <Path d="M12 5.2C10.6 5.2 9.6 6.4 9.6 8C11 8 12 6.8 12 5.2Z" {...line} />
          <Path d="M12 5.2C13.4 5.2 14.4 6.4 14.4 8C13 8 12 6.8 12 5.2Z" {...line} />
        </>
      )}

      {macroKey === 'sugar' && (
        <>
          {/* A lump, drawn as a cube rather than a crystal so it reads at 18px. */}
          <Path d="M12 3.6L19.6 7.8L12 12L4.4 7.8Z" {...line} />
          <Path d="M4.4 7.8V16.2L12 20.4V12" {...line} />
          <Path d="M19.6 7.8V16.2L12 20.4" {...line} />
        </>
      )}

      {macroKey === 'freeSugar' && (
        <>
          {/* THE SAME CUBE, WITH A SPOON OVER IT. Free sugar is not a
              different substance from sugar - it is the same chemistry,
              ADDED rather than built in - so a wholly different mark would
              say they are unrelated things. The spoon is what makes it the
              added one, and it is the only part that differs. */}
          <Path d="M13.2 5.6L19.8 9.2L13.2 12.8L6.6 9.2Z" {...line} />
          <Path d="M6.6 9.2V16L13.2 19.6V12.8" {...line} />
          <Path d="M19.8 9.2V16L13.2 19.6" {...line} />
          <Path d="M6.2 4.2C4.5 4.2 3.4 5.2 3.4 6.4C3.4 7.6 4.5 8.4 6.2 8.4C7.9 8.4 9 7.6 9 6.4C9 5.2 7.9 4.2 6.2 4.2Z" {...line} />
          <Path d="M6.2 8.4V13.4" {...line} />
        </>
      )}

      {macroKey === 'fibre' && (
        <>
          {/* A leaf with its rib: the plant part you do not digest. */}
          <Path d="M5.8 18.2C5.8 10.4 11.6 5.4 18.2 5.4C18.2 12.8 12.8 18.2 5.8 18.2Z" {...line} />
          <Path d="M5.8 18.2C9 15.2 12.8 11.4 16 9" {...line} />
        </>
      )}

      {macroKey === 'salt' && (
        <>
          {/* The cellar, not a crystal - salt arrives in food already, and a
              shaker is the one shape nobody misreads. */}
          <Path d="M9 9.6H15L16 18.8C16.1 19.8 15.4 20.6 14.4 20.6H9.6C8.6 20.6 7.9 19.8 8 18.8Z" {...line} />
          <Path d="M9.2 9.6C9.2 6.4 10.3 4.4 12 4.4C13.7 4.4 14.8 6.4 14.8 9.6" {...line} />
          <Circle cx="10.7" cy="7" r="0.5" fill={stroke} />
          <Circle cx="13.3" cy="7" r="0.5" fill={stroke} />
          <Circle cx="12" cy="8.6" r="0.5" fill={stroke} />
        </>
      )}

      {macroKey === 'calcium' && (
        // A bone: the place a long shortfall actually shows.
        <Path
          d="M9.5 17.7A2.4 2.4 0 1 1 6.3 14.5A2.4 2.4 0 1 1 9.5 11.3L14.5 6.3A2.4 2.4 0 1 1 17.7 9.5A2.4 2.4 0 1 1 14.5 12.7Z"
          {...line}
        />
      )}

      {macroKey === 'iron' && (
        <>
          {/* A red cell face on, which is where the iron in food ends up - and
              the one mark here that cannot be mistaken for a drop. */}
          <Circle cx="12" cy="12" r="7.2" {...line} />
          <Circle cx="12" cy="12" r="3" {...line} />
        </>
      )}
    </Svg>
  );
}
