// A DRINK WITH CALORIES IN IT IS FOOD (Bug 17, Ruth, 21 September 2026).
//
//   "Tea with milk is currently being logged as hydration only, with no
//   calories captured. Any drink containing milk, sugar, or other caloric
//   additions should route through food logging to capture macros, not water
//   tracking. Plain water, black tea, black coffee, and herbal tea can sit in
//   water tracking. Anything caloric needs to log macros too."
//
// WHERE IT CAME FROM, exactly: the classifier was told 'hydration' means "only
// about drinking water or another zero-calorie drink (a glass of water, A MUG
// OF TEA)". In Britain a mug of tea has milk in it. The example taught the
// model the wrong thing, and the volume parser then read any tea as 250ml of
// water and nothing else. Nobody's calories were wrong by much per cup; they
// were wrong every single cup, all day, for as long as the app has existed.
//
// AND THE VOLUME STILL COUNTS. Asked whether a milky tea should also reach the
// water figure, Ruth chose both: "macros AND its volume as water". She is
// right, and it is not double counting - calories and millilitres are different
// axes, and a mug of tea genuinely is both about sixty calories and about three
// hundred millilitres of fluid. Recording one and not the other would be
// choosing which true thing to keep.
//
// THIS FILE IS THE GUARD, NOT THE JUDGEMENT. The model decides the ambiguous
// readings, because that is what it is good at - whether "a cuppa" has milk in
// it, whether "tea" means builder's or peppermint. Code decides the ones that
// cannot be argued with: a phrase that SAYS milk, sugar, honey or syrup, or
// that names a drink made of them, can never be logged as water alone. That is
// the thing that must not happen, so it is enforced where the row is written
// rather than asked for in a prompt.

/**
 * Caloric by composition. No denial cancels these, because there is no version
 * of a latte or a milkshake without calories in it.
 */
const ALWAYS_CALORIC = [
  'latte', 'cappuccino', 'macchiato', 'mocha', 'flat white', 'cortado',
  'hot chocolate', 'hot choc', 'milkshake', 'smoothie', 'frappe', 'frappuccino',
  'juice', 'horlicks', 'ovaltine', 'kefir', 'lassi', 'chai',
];

/** Caloric because of the sugar in them, and only because of it. */
const SWEETENED = ['lemonade', 'cola', 'coke', 'pepsi', 'fanta', 'lucozade', 'ribena'];

/** Dairy, or a milk substitute. Every one of them carries calories. */
const MILKY = [
  'milk', 'semi-skimmed', 'skimmed', 'whole milk', 'oat milk', 'almond milk',
  'soya milk', 'soy milk', 'cream', 'creamer',
];

/** Sugar, by any of its names. */
const SUGARY = ['sugar', 'sugars', 'honey', 'syrup', 'sweetened', 'condensed'];

// A DENIAL CANCELS ONLY WHAT IT DENIES. The first version of this cancelled
// everything, so "unsweetened almond milk" came back as calorie-free - which is
// wrong, because unsweetened is a statement about the sugar and says nothing
// about the almonds. The trouble somebody goes to in order to be precise must
// never be the thing that loses their calories.
const NO_SUGAR = ['sugar free', 'sugar-free', 'no sugar', 'without sugar', 'unsweetened', 'zero sugar', 'diet', 'coke zero'];
const NO_MILK = ['no milk', 'without milk', 'black coffee', 'black tea', 'black'];

function normalise(text: string | null | undefined): string {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9%\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// String.raw, because a backslash inside a template literal is not a backslash.
// Written as `\s` this became a plain "s" and every phrase silently stopped
// matching - the third time this exact trap has cost an hour on this project.
function mentions(haystack: string, needles: string[]): boolean {
  return needles.some((n) =>
    new RegExp(String.raw`(^|\s)` + n.replace(/-/g, '[- ]') + String.raw`(s|es)?($|\s)`).test(haystack)
  );
}

/**
 * Whether this drink carries calories, on the evidence of the words alone.
 *
 * Deliberately conservative: it answers yes only when the text SAYS so. A bare
 * "tea" or "coffee" is left to the model, which has the conversation and knows
 * whether somebody means builder's or peppermint - a heuristic here would have
 * to guess, and guessing wrong in either direction writes a wrong row.
 */
export function drinkHasCalories(text: string | null | undefined): boolean {
  const t = normalise(text);
  if (!t) return false;
  if (mentions(t, ALWAYS_CALORIC)) return true;
  if (mentions(t, SWEETENED) && !mentions(t, NO_SUGAR)) return true;
  if (mentions(t, MILKY) && !mentions(t, NO_MILK)) return true;
  if (mentions(t, SUGARY) && !mentions(t, NO_SUGAR)) return true;
  return false;
}

/**
 * Alcohol, which is the one drink whose volume must NOT reach the water figure.
 *
 * Ruth's rule was about calories, and alcohol has them - so it logs as food
 * either way. The volume is the separate question, and counting a pint as
 * 568ml of hydration would be worse than counting nothing: alcohol is a
 * diuretic, so the honest answer is not "some of it" but "this is not what the
 * water figure is for". Someone reading a good hydration day built out of wine
 * would be reading a false day.
 */
const ALCOHOL = [
  'beer', 'lager', 'ale', 'stout', 'cider', 'wine', 'prosecco', 'champagne',
  'gin', 'vodka', 'whisky', 'whiskey', 'rum', 'brandy', 'tequila', 'cocktail',
  'mojito', 'margarita', 'negroni', 'aperol', 'spritz', 'sangria', 'pint of',
  'g and t', 'gin and tonic', 'shandy', 'bucks fizz', 'martini', 'bellini',
];

export function drinkIsAlcohol(text: string | null | undefined): boolean {
  const t = normalise(text);
  if (!t) return false;
  // "Alcohol free" and "0%" are the exception that has to win, for the same
  // reason "sugar free" does.
  if (mentions(t, ['alcohol free', 'alcohol-free', 'non alcoholic', 'non-alcoholic', '0%', 'mocktail'])) return false;
  return mentions(t, ALCOHOL);
}

/**
 * What a drink phrase should do, in one answer.
 *
 * `macros` - it must reach food logging, or its calories are lost.
 * `water`  - its volume belongs in the water figure.
 */
export function drinkRouting(text: string | null | undefined): { macros: boolean; water: boolean } {
  if (drinkIsAlcohol(text)) return { macros: true, water: false };
  return { macros: drinkHasCalories(text), water: true };
}
