import type { ParsedItem } from './food-parse-prompt';

// SEVERAL THINGS ARE SEVERAL ROWS (Bug 18, Ruth, 21 September 2026).
//
//   "When a user logs multiple items in one message (e.g. 'mug of tea and a
//   cookie'), they are being stored as one combined entry. When the user then
//   asks to break it down by item, the data isn't there - it was lost at
//   storage time ... This is a data architecture issue, not just a display
//   issue."
//
// She is exactly right, and the cause was a licence in the prompt: two of the
// four breakdown types told the model to leave `items` EMPTY - "simple" for a
// single thing, "consistent_ratio" for a lasagne. Neither was meant to cover a
// LIST of things somebody named, but both read as permission to merge them, so
// whether a person could ever see the split came down to a model's aesthetic
// judgement about a dish.
//
// The prompt is fixed. This is the part that does not depend on the prompt.
//
// WHAT CODE CAN AND CANNOT DO HERE. It cannot split the calories: sixty-five
// kilocalories across a herbal tea, a milky tea and a biscuit is a division
// nobody stated, and inventing it would be worse than the bug. What it CAN do
// is notice - a message that plainly names three things came back with one row,
// and that is a contradiction visible without knowing anything about food. So
// it asks again, once, saying what went wrong. A second refusal is stored as it
// came, because a wrong number is worse than a missing breakdown.

/** The words people join a list with, and the punctuation that does the same job. */
const JOINERS = /(?:,|\band\b|\bplus\b|\bwith\b|&|\+)/gi;

/**
 * Roughly how many separate things this entry names.
 *
 * DELIBERATELY ROUGH, and only ever used to catch an obvious contradiction -
 * never to decide what the items ARE. "Steak with peppercorn sauce" counts as
 * two and is one dish with a sauce; that is fine, because two rows for it is a
 * perfectly good record and the model will say so when asked again.
 */
export function thingsNamed(entryText: string | null | undefined): number {
  const text = String(entryText ?? '').trim();
  if (!text) return 0;
  const parts = text
    .split(JOINERS)
    .map((p) => p.trim())
    // A fragment has to have a word in it that is not just a number or a unit,
    // or "200g" on its own would count as a thing.
    .filter((p) => /[a-z]{3}/i.test(p));
  return parts.length;
}

/**
 * Whether the breakdown contradicts the entry it came from.
 *
 * Only fires on a clear contradiction: two or more things named, fewer than two
 * rows stored. One thing described in a long sentence is left alone, and so is
 * anything already itemised.
 */
export function underItemised(entryText: string | null | undefined, items: ParsedItem[] | undefined): boolean {
  const rows = items?.length ?? 0;
  if (rows >= 2) return false;
  return thingsNamed(entryText) >= 2;
}

/** The entries in a parse whose breakdown contradicts their own text. */
export function entriesNeedingSplit(
  entries: { entry_text?: unknown; items?: ParsedItem[] }[] | undefined,
  fallbackText: string
): number {
  let count = 0;
  for (const e of entries ?? []) {
    const text = typeof e.entry_text === 'string' && e.entry_text.trim() ? e.entry_text : fallbackText;
    if (underItemised(text, e.items)) count += 1;
  }
  return count;
}

/** What to say to the model on the second attempt. Names the fault, not the fix. */
export const SPLIT_AGAIN =
  ' YOUR PREVIOUS ANSWER MERGED THINGS THAT WERE NAMED SEPARATELY. At least one entry lists several distinct things ' +
  'and came back with fewer than two rows in items. Return the same entries again, but with EVERY thing the person ' +
  'named as its own row in items, each with its own macro figures - "mug of tea and a cookie" is two rows, ' +
  '"herbal tea, English tea with milk, and a biscuit" is three. The totals should still be the sum of the rows. ' +
  'Do not merge a list into one row for any reason: a figure stored as one lump can never be separated afterwards.';
