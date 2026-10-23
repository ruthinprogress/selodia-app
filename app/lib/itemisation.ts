import { drinksNamedIn, mentionsDrink } from './caloric-drink';
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
  if (drinkMissingFromItems(entryText, items)) return true;
  const rows = items?.length ?? 0;
  if (rows >= 2) return false;
  return thingsNamed(entryText) >= 2;
}

/**
 * A drink the person named that never became a row.
 *
 * THE COUNT WAS NOT ENOUGH (23 September 2026). "Chicken salad with avocado and
 * a flat white for lunch" came back as three items - Chicken, Salad, Avocado -
 * and no flat white. The check above never fired, and was right not to by its
 * own logic: three rows is comfortably more than the two things that sentence
 * reads as, so by counting alone the breakdown looked generous.
 *
 * Counting cannot see WHICH thing went missing. A drink is the one kind of item
 * worth naming specifically, because it is the only one that also has to reach
 * somewhere else, and because a dropped drink loses calories and millilitres at
 * the same time while the reply cheerfully confirms it was added.
 */
export function drinkMissingFromItems(
  entryText: string | null | undefined,
  items: ParsedItem[] | undefined
): boolean {
  const named = drinksNamedIn(entryText);
  if (named.length === 0) return false;
  const rows = items ?? [];
  return named.some(
    (drink) => !rows.some((it) => mentionsDrink(String((it as { name?: unknown }).name ?? ''), drink.noun))
  );
}

/**
 * THE DRINK GETS A ROW EVEN WHEN THE MODEL WILL NOT GIVE IT ONE.
 *
 * Found 23 October 2026, still live more than a month after Ruth reported it.
 * "Mug of tea and a cookie" comes back as one item - the cookie - and the tea
 * is gone from `items` entirely, although it reaches `drinks` and hydration
 * correctly. The detector above fires, the retry fires, the retry asks for the
 * split by name and quotes this exact sentence, and the second answer is the
 * same as the first. Two attempts, both refused, every time.
 *
 * WHY THE PROMPT IS NOT THE FIX, and I spent a model call establishing it: the
 * instruction is already there in four places, including "Include a zero-calorie
 * item they mentioned (a black coffee, a tea) as its own row rather than
 * dropping it". A fifth sentence would be the fourth round of asking a model
 * not to do something twice, and a guard belongs at the write.
 *
 * WHAT THIS ADDS AND WHAT IT REFUSES TO ADD. A row with the drink's own words
 * and NO FIGURES AT ALL. Her report was about architecture - "the data isn't
 * there, it was lost at storage time" - and what was lost is the row, not the
 * macros. A named row with nulls is a record somebody can later ask about, and
 * every surface in this app already reads a null macro as "nobody worked this
 * out" and leaves it off rather than printing a zero.
 *
 * It will not invent the figures. Splitting 65 kcal between a tea and a cookie
 * is a division nobody stated, and this file's own rule is that a wrong number
 * is worse than a missing breakdown. The tea's calories stay inside the entry
 * total where the model put them, which is why item figures are documented as
 * only roughly summing to the total.
 *
 * ONE ROW PER MISSING DRINK, and only for a drink the person actually named.
 * This never touches an entry whose drinks all made it through.
 */
export function withMissingDrinks(
  entryText: string | null | undefined,
  items: ParsedItem[] | undefined
): ParsedItem[] {
  const rows = [...(items ?? [])];
  for (const drink of drinksNamedIn(entryText)) {
    const present = rows.some((it) =>
      mentionsDrink(String((it as { name?: unknown }).name ?? ''), drink.noun)
    );
    // HER OWN WORDS, including the quantity - "three black coffees", not
    // "coffee". phrase is what she typed; noun is only for the comparison.
    if (!present) rows.push({ name: drink.phrase });
  }
  return rows;
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
  'Do not merge a list into one row for any reason: a figure stored as one lump can never be separated afterwards. ' +
  'AND EVERY DRINK IS ONE OF THOSE THINGS. A drink named alongside food is its own row in items when it carries ' +
  'calories, and belongs in "drinks" either way - "chicken salad with avocado and a flat white" is a salad, an ' +
  'avocado AND a flat white, never just the food. Leaving the drink out while confirming it was added is the exact ' +
  'failure this retry exists to catch.';
