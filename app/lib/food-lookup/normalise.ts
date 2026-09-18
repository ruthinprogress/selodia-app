// Turning what somebody typed into something a cache can match on.
//
// THIS FILE IS THE WHOLE RISK OF THE HYBRID LOOKUP. Every other part is
// plumbing; this is the part that decides whether two descriptions are the same
// food, and a wrong yes means somebody is shown calories they never ate. So it
// is deliberately timid: it collapses the ways people write the same thing, and
// it refuses to collapse anything that might change the answer.
//
// THE SPEC SAYS TO STRIP QUANTITIES. It is wrong, and this is the one place the
// spec is knowingly departed from (recorded in the migration too). "Strip
// quantities and portion words" makes "73g potatoes" and "200g potatoes" the
// same key, so the second lookup returns the first one's macros. The quantity is
// not noise around the food; on a weighed entry it IS most of the answer.
//
// WHAT IS COLLAPSED: case, punctuation, runs of whitespace, and the handful of
// words that carry no food ("a", "some", "of", "with a bit of"). What is NOT:
// numbers, units, cooking words (boiled, fried, roasted - a roast potato is not
// a boiled one), brands, or anything it does not recognise.

const FILLER = new Set([
  'a', 'an', 'the', 'some', 'of', 'my', 'i', 'had', 'have', 'ate', 'just',
  'bit', 'little', 'about', 'roughly', 'approx', 'approximately',
]);

/** The cache key: lowercase, punctuation collapsed, quantities kept. */
export function normaliseFoodName(text: string): string {
  return text
    .toLowerCase()
    // Keep digits and letters; a decimal point inside a number is kept because
    // 2.5 and 25 are different weights.
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+\./g, ' ')
    .split(' ')
    .filter((w) => w.length > 0 && !FILLER.has(w))
    .join(' ')
    .trim();
}

export type Quantity = { grams: number } | { millilitres: number } | null;

// A weighed entry is the only kind this system can answer from a per-100g
// source, because everything else needs a judgement about portion size - and a
// judgement is exactly what the model is for.
//
// Deliberately narrow: a number immediately followed by g/gram/grams/ml, at the
// start of the description or straight after a filler word. "73g boiled new
// potatoes" qualifies. "A handful of almonds" does not, and must not.
const WEIGHED = /(^|\s)(\d+(?:\.\d+)?)\s?(g|gram|grams|ml|millilitre|millilitres)(\s|$)/;

export function readQuantity(text: string): Quantity {
  const m = WEIGHED.exec(text.toLowerCase());
  if (!m) return null;
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return null;
  return m[3].startsWith('m') ? { millilitres: n } : { grams: n };
}

/**
 * The food without its weight, for asking a per-100g source about it.
 *
 * "73g boiled new potatoes" -> "boiled new potatoes". Returns null when there is
 * nothing left, or when what is left is too thin to identify a food: a lookup on
 * "g" would match something, and that something would be wrong.
 */
export function foodWithoutQuantity(text: string): string | null {
  const stripped = normaliseFoodName(text.toLowerCase().replace(WEIGHED, ' '));
  if (stripped.length < 3) return null;
  // A description with several commas is a meal, not an item, and no per-100g
  // source can answer it. The model handles meals; this handles foods.
  if ((text.match(/,/g) ?? []).length > 0) return null;
  if (stripped.split(' ').length > 6) return null;
  return stripped;
}

/**
 * Does this entry describe ONE food, weighed?
 *
 * The only shape tier 2 may answer. Everything else - a meal, a handful, a
 * photograph, "leftover pasta thing" - belongs to the model, which is what it is
 * good at and what the cost of this system was never meant to buy out of.
 */
export function isSingleWeighedFood(text: string): boolean {
  return readQuantity(text) !== null && foodWithoutQuantity(text) !== null;
}
