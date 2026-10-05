// HOW MANY TAP CHIPS FIT ON A ROW (Ruth, 5 October 2026).
//
//   "just put the tap chips next to each other in rows of 3 so they don't take
//   up so much space"
//
// One chip per line turned the steer-around screen into a column of twenty-five
// and the periods question into a column of nine. Three to a row is a quarter of
// the height for the short ones.
//
// WHY THIS IS A FUNCTION AND NOT A STYLE. Not every chip can take a third of a
// phone. "I don't have periods for another reason" is thirty-eight characters,
// and "Surgical menopause" carries a second line of hint underneath it. A rule
// that gives every chip a third of the width either truncates those or stacks
// them five lines deep in a box a third as wide as the sentence.
//
// AND TRUNCATION IS NOT AVAILABLE HERE, which is the lesson of the "Wee" tab.
// Android measured an autosizing label in the system typeface and drew it in
// Manrope, so every unselected tab lost exactly its last letter for three
// attempts running. Nothing in this app may shrink text to fit or clip it: a chip
// that cannot fit a third of the width takes the whole width.
//
// SO THE RULE IS ABOUT THE CHIP, NOT THE SCREEN. It is a pure function of the
// option, which means check-chip-layout.mjs can run it over every real chip list
// in the app and say what each one will look like - rather than a style nobody
// can test until it is on a phone.

/**
 * The widest a label can be and still read inside a third of a phone.
 *
 * SET FROM THE REAL CHIPS, not from what fits on one line. Twenty was the
 * one-line figure, and it pushed "Heavy lifting at load" and "Impact, such as
 * jumping" to a row each - which is two of the four movement chips taking a full
 * width to save a second line, and the opposite of what she asked for.
 *
 * A THIRD-WIDTH CHIP IS ALLOWED TO BE TWO LINES TALL. Every chip in a row
 * stretches to the tallest, so a two-line label among one-line ones costs one
 * line of height for the row rather than three rows. Twenty-six takes every
 * current chip in the app except a hint, and still sends a sentence like "I don't
 * have periods for another reason" to its own row where it belongs.
 */
export const THIRD_WIDTH_MAX_CHARS = 26;

export type ChipSpan = 'third' | 'full';

/**
 * How much of the row this chip takes.
 *
 * A HINT ALWAYS TAKES THE WHOLE WIDTH. The hint exists to hold a distinction
 * ("Caused by surgery, with the ovaries removed"), and a distinction that wraps
 * every three words is not one anybody reads.
 */
export function chipSpan(option: { label: string; hint?: string }): ChipSpan {
  if (option.hint) return 'full';
  return option.label.length <= THIRD_WIDTH_MAX_CHARS ? 'third' : 'full';
}

/**
 * The rows a list of chips will actually produce, for a check to assert on.
 *
 * Flex wrapping is not a free-for-all: a full-width chip ends the row it lands
 * in, so a long label in the middle of six short ones leaves a gap rather than
 * silently reflowing them. That is visible here, in a list, instead of only on a
 * phone.
 */
export function chipRows<T extends { label: string; hint?: string }>(options: readonly T[]): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  for (const option of options) {
    if (chipSpan(option) === 'full') {
      if (row.length > 0) rows.push(row);
      rows.push([option]);
      row = [];
      continue;
    }
    row.push(option);
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}
