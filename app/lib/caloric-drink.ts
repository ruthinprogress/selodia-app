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

// ---------------------------------------------------------------------------
// FINDING A DRINK NOBODY HANDED US (23 September 2026)
// ---------------------------------------------------------------------------
//
// Everything above answers "what does this drink do", and assumes a drink
// phrase has been handed to it. The failure found on 23 September was one step
// earlier: there was no phrase at all.
//
//   Sent:      "Chicken salad with avocado and a flat white for lunch"
//   Reply:     "Got it - the chicken salad with avocado and the flat white are added."
//   raw_text:  "chicken salad with avocado, flat white"
//   items:     Chicken, Salad, Avocado
//   hydration: nothing
//
// The model understood the flat white, said so, wrote it into the entry text,
// and then left it out of BOTH structured fields. The drinks guard never ran
// because it is only ever given what is in `drinks`, and the flat white was
// not in `drinks`.
//
// So this is the guard one layer down: the drinks a person named, read from
// their own words, owing nothing to what came back. A prompt asking for every
// drink already exists and is detailed and emphatic, and it was not enough.
// A rule the model is asked to follow is not a guard.

/**
 * Every drink this app can recognise by name. One list, because it was three
 * before and they disagreed: `parseVolumeMl` knew about tea, coffee and squash
 * and had never heard of a latte, so a flat white that DID reach the hydration
 * path would still have been measured as nothing.
 */
export const DRINK_NOUNS = [
  // The espresso bar. Absent from the volume parser until today, which is the
  // second half of the same bug.
  'flat white', 'latte', 'cappuccino', 'macchiato', 'mocha', 'cortado',
  'americano', 'espresso', 'frappe', 'frappuccino',
  // Hot things.
  'hot chocolate', 'hot choc', 'horlicks', 'ovaltine', 'chai',
  'coffee', 'tea', 'brew', 'cuppa', 'decaf', 'herbal',
  // Cold things.
  'milkshake', 'smoothie', 'juice', 'squash', 'cordial', 'lemonade',
  'cola', 'coke', 'pepsi', 'fanta', 'lucozade', 'ribena', 'kefir', 'lassi',
  'milk', 'water',
  // Alcohol. It is a drink even though its volume is not hydration, because
  // this list answers "was a drink named", and routing decides the rest.
  'beer', 'lager', 'ale', 'stout', 'cider', 'wine', 'prosecco', 'champagne',
  'gin', 'vodka', 'whisky', 'whiskey', 'rum', 'brandy', 'tequila', 'cocktail',
  'mojito', 'margarita', 'negroni', 'aperol', 'spritz', 'sangria', 'shandy',
  'martini', 'bellini',
];

/**
 * A word that turns the drink before it into a food. "A coffee cake is not a
 * coffee" is already in the parse prompt; this is the same rule where it cannot
 * be ignored. Milk chocolate is not milk, and a rum truffle is not a rum.
 */
const MAKES_IT_FOOD = [
  'cake', 'cakes', 'bun', 'buns', 'biscuit', 'biscuits', 'bread', 'loaf',
  'slice', 'tart', 'sponge', 'muffin', 'pudding', 'trifle', 'truffle',
  'truffles', 'chocolate', 'ice', 'powder', 'sauce', 'soup', 'battered',
];

/**
 * Words that may be swept up in front of a drink, because they describe how
 * much of it there was or what kind it is. Anything not on this list ends the
 * run-up.
 *
 * THE RUN-UP HAS TO STOP SOMEWHERE (23 September 2026). The first version took
 * the four preceding words whatever they were, so "chicken salad with avocado,
 * flat white" produced the drink phrase "chicken salad with avocado flat
 * white". That measured fine, and then poisoned every comparison built on it:
 * asked whether the drink was among the items, "chicken" matched, and the guard
 * concluded the flat white was already there. The fix that caused the bug.
 */
const RUN_UP = new Set([
  'a', 'an', 'another', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'couple', 'of', 'about', 'approx', 'around',
  'glass', 'glasses', 'mug', 'mugs', 'cup', 'cups', 'pint', 'pints',
  'bottle', 'bottles', 'can', 'cans', 'shot', 'shots',
  'large', 'small', 'big', 'tall', 'grande', 'venti', 'double', 'single',
  'black', 'white', 'iced', 'hot', 'cold', 'strong', 'weak', 'fresh',
  'decaf', 'herbal', 'oat', 'almond', 'soya', 'soy', 'skimmed', 'semi-skimmed',
  'whole', 'red', 'green', 'sparkling', 'still', 'tap',
]);

export type NamedDrink = {
  /** The drink itself, for deciding whether it is already accounted for. */
  noun: string;
  /** The drink with its quantity, for measuring. "three black coffees". */
  phrase: string;
};

/**
 * The drinks named in a piece of text.
 *
 * Longest name first, so "flat white" is found before "white" could be, and a
 * span already claimed is never matched twice - "hot chocolate" must not also
 * report a "chocolate".
 *
 * Returns the noun and the phrase separately ON PURPOSE. They answer different
 * questions and conflating them is what broke the first attempt: the phrase
 * needs the run-up so a count survives, and the noun must have none of it so a
 * comparison cannot drift onto a neighbouring word.
 */
export function drinksNamedIn(text: string | null | undefined): NamedDrink[] {
  const t = normalise(text);
  if (!t) return [];

  const claimed: boolean[] = new Array(t.length).fill(false);
  const found: { at: number; drink: NamedDrink }[] = [];

  for (const noun of [...DRINK_NOUNS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(
      String.raw`(^|\s)(` + noun.replace(/-/g, '[- ]') + String.raw`)(s|es)?(?=$|\s)`,
      'g'
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const start = m.index + m[1].length;
      const end = start + m[2].length + (m[3] ? m[3].length : 0);
      re.lastIndex = end;

      // Already inside a longer drink name.
      let overlaps = false;
      for (let i = start; i < end; i += 1) if (claimed[i]) overlaps = true;
      if (overlaps) continue;

      // "Coffee cake" is cake.
      const after = t.slice(end).trim().split(' ')[0] ?? '';
      if (MAKES_IT_FOOD.includes(after)) continue;

      for (let i = start; i < end; i += 1) claimed[i] = true;

      // Walk backwards only through words that describe the drink.
      const before = t.slice(0, start).trim().split(' ').filter(Boolean);
      const runUp: string[] = [];
      for (let i = before.length - 1; i >= 0; i -= 1) {
        const w = before[i];
        if (RUN_UP.has(w) || /^\d+(\.\d+)?$/.test(w)) runUp.unshift(w);
        else break;
      }

      const matched = t.slice(start, end);
      found.push({
        at: start,
        drink: { noun, phrase: (runUp.length ? runUp.join(' ') + ' ' : '') + matched },
      });
    }
  }

  return found.sort((a, b) => a.at - b.at).map((f) => f.drink);
}

/**
 * Whether this text accounts for that drink - used to decide whether a drink
 * read out of somebody's words is genuinely missing from what came back.
 *
 * Compares against the NOUN, never the phrase. A phrase carries its quantity
 * and its adjectives, and matching on those is how "chicken" once counted as a
 * flat white.
 */
export function mentionsDrink(text: string | null | undefined, noun: string): boolean {
  const t = normalise(text);
  if (!t) return false;
  return mentions(t, [noun]);
}
