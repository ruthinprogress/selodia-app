import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { NutrientIcon } from '@/components/nutrient-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BodyFont, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MACROS, macroAmount, macroFigure, type MacroKey } from '@/lib/tracked-macros';
import {
  referenceFor,
  standingFor,
  NO_NUTRIENT_PROFILE,
  STANDING_COLOUR,
  type NutrientProfile,
  type Reference,
  type Standing,
} from '@/lib/nutrient-standing';

// THE GRID FROM HER ARTWORK, BUILT FROM HER ARTWORK THIS TIME.
//
// Ruth asked on 22 October: "show me a sample to see first and then build." I
// showed six colourways - swatches - and then built a layout she had never
// seen. Her verdict on it, 24 October: "the main screen is nothing like the
// artwork, the follow through screens weren't make, just pointed to the generic
// list of nutrients we already had."
//
// WHAT THE ARTWORK ACTUALLY SAYS, and all three were in the drawing the whole
// time:
//
//   "Icon colour shows how you're doing."
//       The colour of the mark is the ONLY thing carrying the state. No bar, no
//       word on the cell, no sentence underneath. The first version had all
//       three, which is why she said "this is not calm".
//
//   "Why colour, not dots? Using the icon colour keeps the screen clean and
//    calm, while still giving you an instant visual sense of what's in range."
//       Her artwork had already answered the question I spent a day solving
//       badly.
//
//   "Each nutrient is compared to a range based on your goals, age and sex."
//       Which is also the answer to the question she asked me two hours before
//       I found this: whether the targets could be personal rather than generic.
//
// THE CELL IS FOUR THINGS: a coloured mark, a chevron, a figure, a name. It
// reads in about a second, which is the whole point of a grid. Everything else
// - what it is measured against, why it matters, where it came from - belongs
// on the nutrient's own screen, one chevron away.
//
// A LIGHTER PANEL INSIDE THE CARD, which is hers too and solves a real problem:
// "If you copy the artwork and have a lighter square inside the Daily average
// this week square, then you don't have the color problem you invented." She is
// right. On the sand the card is made of, her colourway measures 2.02 to 2.56
// against a 3.0 floor; on the cream panel the artwork draws, it measures 2.58
// to 3.26. The structure fixed what I had been trying to fix with pigment.

/** One cell: everything resolved, so the render holds no arithmetic. */
type Cell = {
  key: MacroKey;
  label: string;
  figure: string;
  standing: Standing | null;
  reference: Reference | null;
  /** The part of something bigger that sits underneath it - sat fat, sugar. */
  child: Cell | null;
};

/**
 * THE TWO THAT ARE A PART OF SOMETHING ELSE, and what they sit under.
 *
 * Saturated fat belongs to fat and sugar belongs to carbohydrate. Ruth, 24
 * October, asked for them kept this way - "nest sat fat and sugar like now" -
 * and the card has drawn them nested since her 22 October artwork. It is the
 * only hierarchy here and it is what stops ten cells reading as ten equals.
 */
const UNDER: Partial<Record<MacroKey, MacroKey>> = {
  saturated: 'fat',
  sugar: 'carbs',
};

function cellFor(
  key: MacroKey,
  values: Record<string, unknown>,
  profile: NutrientProfile
): Cell | null {
  const spec = MACROS.find((m) => m.key === key);
  const figure = spec ? macroFigure(key, values) : null;
  // NOTHING WORKED OUT, NOTHING SHOWN. A zero would assert the food contained
  // none of it, which is a different claim and usually the wrong one.
  if (!spec || figure == null) return null;
  const reference = referenceFor(key, profile);
  return {
    key,
    label: spec.short.toLowerCase(),
    figure,
    reference,
    standing: standingFor(macroAmount(key, values), reference),
    child: null,
  };
}

/**
 * THE ORDER THE CELLS ARE DRAWN IN, which is not the spine's order (Ruth, 24
 * October 2026).
 *
 * Her suggestion, and she was right about why: "I'm just wondering if we put
 * fat and carbs below kcal and protein, and move fibre and salt to the top
 * right, if it will look nicer."
 *
 * IT EVENS THE ROWS, and that is the real gain. Fat and carbs are the only two
 * cells that carry a nested line underneath them, so in the spine's order both
 * tall cells sat in the TOP row and the grid stood a line lopsided. With them
 * moved down, the four single-line cells make the first row and the two tall
 * ones share the second.
 *
 * It reads better too: energy and protein, then the two she watches as figures
 * in their own right, then the two composites with their parts, then the
 * minerals.
 *
 * A SEPARATE LIST RATHER THAN A REORDERED SPINE. MACROS drives the parser's
 * schema, the database columns, the chat summary and the settings list. This is
 * a fact about one grid's layout, and it has no business moving any of that.
 *
 * ANYTHING NOT NAMED HERE STILL APPEARS, at the end. A nutrient added to the
 * spine and forgotten here is drawn late rather than not at all.
 */
const GRID_ORDER: MacroKey[] = [
  'kcal',
  'protein',
  'fibre',
  'salt',
  'fat',
  'carbs',
  'calcium',
  'iron',
];

export function nutrientCells(
  values: Record<string, unknown>,
  tracked: MacroKey[],
  profile: NutrientProfile
): Cell[] {
  const ordered = [
    ...GRID_ORDER,
    ...MACROS.map((m) => m.key).filter((k) => !GRID_ORDER.includes(k)),
  ];

  const cells: Cell[] = [];
  for (const key of ordered) {
    if (!tracked.includes(key) || UNDER[key]) continue;
    const cell = cellFor(key, values, profile);
    if (!cell) continue;
    const childKey = (Object.keys(UNDER) as MacroKey[]).find(
      (k) => UNDER[k] === key && tracked.includes(k)
    );
    cell.child = childKey ? cellFor(childKey, values, profile) : null;
    cells.push(cell);
  }
  return cells;
}

/**
 * Would the grid draw anything?
 *
 * A CALLER CANNOT ASK A COMPONENT WHETHER IT RENDERED NULL. An earlier version
 * wrote `<NutrientGrid … /> ?? <ThemedText …>`, which looks like a fallback and
 * is dead code: a JSX element is an object, so it is never null.
 */
export function hasNutrientTiles(values: Record<string, unknown>, tracked: MacroKey[]): boolean {
  return (
    nutrientCells(values, tracked, NO_NUTRIENT_PROFILE).length > 0
  );
}

/** Four across, as drawn. Anything wider clips "488 mg". */
const PER_ROW = 4;

export function NutrientGrid({
  values,
  tracked,
  profile,
  compact = false,
}: {
  /** The figures being judged, keyed by column - a week's average, or a day. */
  values: Record<string, unknown>;
  tracked: MacroKey[];
  profile: NutrientProfile;
  /**
   * SMALLER MARKS, FOR THE DAY ROWS (Ruth, 24 October 2026): "Daily food log
   * still has the large icons, put the snall ones back."
   *
   * The same grid draws the week's average at the top of the screen and each
   * day inside the list, and it was drawing them identically - so when the
   * card's marks doubled, as she asked, every day row doubled with them.
   *
   * THEY ARE NOT DOING THE SAME JOB. The card is the thing somebody arrives at
   * and reads at a glance, where a 36pt mark is the first thing the eye lands
   * on. A day row is read in a column of other day rows, where the same mark is
   * eight large icons competing with the eight above and below them.
   *
   * One component, two sizes, because the alternative is two components that
   * drift - and the colour, the nesting and the arithmetic must never differ
   * between the two places the same figure appears.
   */
  compact?: boolean;
}) {
  const theme = useTheme();
  const cells = nutrientCells(values, tracked, profile);
  if (cells.length === 0) return null;

  return (
    // THE LIGHTER SQUARE INSIDE THE CARD. `background` is the cream the page is
    // made of, sitting on the sand the card is made of - two tokens that
    // already exist, which is why this adds no colour to the palette.
    <ThemedView type="background" style={styles.panel}>
      {cells.map((cell, i) => (
        <Pressable
          key={cell.key}
          onPress={() => router.push({ pathname: '/log/nutrient/[key]', params: { key: cell.key } })}
          accessibilityRole="button"
          // THE STATE IS SPOKEN, because a colour says nothing at all to
          // somebody listening and the cell carries no word.
          accessibilityLabel={
            `${cell.figure} ${cell.label}`
            + (cell.standing ? `, ${STANDING_LABEL_SPOKEN[cell.standing]}` : '')
            + (cell.child ? `, with ${cell.child.figure} ${cell.child.label}` : '')
          }
          style={({ pressed }) => [
            styles.cell,
            // The hairlines are the artwork's. They belong to a cell's own
            // right and bottom edge, and are dropped on the last column and the
            // last row by arithmetic on the index - never on where a row
            // happened to wrap.
            (i + 1) % PER_ROW !== 0 && { borderRightWidth: 1, borderRightColor: theme.backgroundElement },
            i < cells.length - (cells.length % PER_ROW || PER_ROW) && {
              borderBottomWidth: 1,
              borderBottomColor: theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.head}>
            {/* THE MARK, AND ITS COLOUR IS THE WHOLE MESSAGE. Grey is reserved
                for the one case it means something - a nutrient with nothing
                honest to compare against - so it is the absence of a state,
                never a default. */}
            {/* TWICE THE SIZE, because the mark is now the only thing carrying
                the state (Ruth, 24 October 2026: "the icons needs to be at
                least twice as big"). At 18 it was an ornament beside a figure;
                at 36 it is the first thing the eye lands on, which is what
                "icon colour shows how you're doing" requires of it. */}
            <NutrientIcon
              macroKey={cell.key}
              size={compact ? 20 : 36}
              color={cell.standing ? STANDING_COLOUR[cell.standing] : theme.textSecondary}
            />
            <ThemedText type="detail" themeColor="textSecondary" style={styles.chevron}>
              ›
            </ThemedText>
          </View>

          <ThemedText type="small" style={compact ? styles.figureCompact : styles.figure}>
            {cell.figure}
          </ThemedText>
          <ThemedText type="detail" themeColor="textSecondary">
            {cell.label}
          </ThemedText>

          {/* NESTED, NOT A CELL OF ITS OWN. Saturated fat is a kind of fat. */}
          {cell.child ? (
            <View style={styles.child}>
              {/* SMALL, AS SHE ASKED. Ruth, 24 October: "I said to leave the
                  smaller icons in the table, youve enlarged them." The parent
                  mark is the one carrying the state at a glance; the nested
                  one is a footnote to it, and at 24 it ate the cell and broke
                  "sat fat" across four lines. */}
              <NutrientIcon
                macroKey={cell.child.key}
                size={compact ? 10 : 12}
                color={
                  cell.child.standing
                    ? STANDING_COLOUR[cell.child.standing]
                    : theme.textSecondary
                }
              />
              <ThemedText
                type="detail"
                themeColor="textSecondary"
                style={styles.childText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {cell.child.figure} {cell.child.label}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ThemedView>
  );
}

/** Said aloud, where the colour cannot be seen. Her four words, lower-cased. */
const STANDING_LABEL_SPOKEN: Record<Standing, string> = {
  'in-range': 'in range',
  'a-little-low': 'a little low',
  lower: 'lower',
  higher: 'higher',
};

const styles = StyleSheet.create({
  panel: { borderRadius: CardRadius, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  cell: { width: `${100 / PER_ROW}%`, padding: Spacing.two, gap: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 15, lineHeight: 18 },
  // BOLD, because the figure is the thing the cell is for (Ruth, 24 October
  // 2026: "the numbers need to be in bold on the card"). It stays in the SANS -
  // the serif is now the heading voice, and a figure is data, not a heading.
  // Sized against the log rows beneath the card, which are 14.
  figure: { fontSize: 17, lineHeight: 21, fontFamily: BodyFont.semibold },
  // A step down for a day row, which is read in a column of other day rows
  // rather than arrived at.
  figureCompact: { fontSize: 15, lineHeight: 19, fontFamily: BodyFont.semibold },
  child: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  // ONE LINE, SHRINKING IF IT MUST. "21 g sat fat" broke into "21 / g s / at /
  // fat" when the icon beside it doubled - four lines of nonsense where a
  // footnote should be.
  childText: { flexShrink: 1, fontSize: 11, lineHeight: 14 },
  pressed: { opacity: 0.6 },
});
