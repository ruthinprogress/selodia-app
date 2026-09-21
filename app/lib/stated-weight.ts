import type { ParsedItem, ParsedMacros } from './food-parse-prompt';

// A WEIGHT SHE STATED IS A WEIGHT OF THE DISH (21 September 2026).
//
// Her report, with the screenshot: "Error is logging chat. I said cheese
// omelette which logged fine, then I had a bit extra and it logged it wrong."
//
// What happened, from her own rows. At 10:59 she logged "100g cheesy omelette
// and half a corn on the cob" and it came back 175 kcal for the omelette -
// correct, and read as a hundred grams OF omelette. At 13:33 she logged "50g
// cheese omelette" and it came back 385 kcal, itemised as two large eggs plus
// fifty grams of cheese: an omelette MADE WITH 50g of cheese. Fifty grams of
// that morning's omelette is about 88. It logged more than four times it, two
// and a half hours after reading nearly the same words correctly.
//
// FOOD MEMORY WAS RIGHT NOT TO CATCH IT, which is worth recording because it
// looks like the obvious culprit. Memory refuses values younger than twelve
// hours, and it refuses them because a chocolate corrected twenty minutes after
// logging came back at the number being corrected. Consistency is a
// between-days problem on purpose.
//
// SO THE PROMPT GAINS A RULE - a leading weight belongs to the dish - AND THIS
// EXISTS BECAUSE A RULE THE MODEL IS ASKED TO FOLLOW IS NOT A GUARD. It is the
// same principle as the food duplicate guard and the report's figures: anything
// that must not happen is enforced in arithmetic the model cannot decline.
//
// THE ARITHMETIC IS SIMPLE AND HARD TO ARGUE WITH. If she stated a weight for
// one dish, the parts the model invented cannot weigh more than the dish does.
// Two large eggs and fifty grams of cheese is about a hundred and fifty grams;
// she said fifty. That is not a judgement about cheese, it is a contradiction
// on a scale, and the macros are scaled back to the weight she actually gave.

/** Grams in a phrase like "50g", "1.2 kg", "200 grams". Null when there is none. */
export function gramsIn(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = String(text)
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|oz|ounces?)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  if (unit.startsWith('kg') || unit.startsWith('kilo')) return n * 1000;
  if (unit.startsWith('oz') || unit.startsWith('ounce')) return n * 28.35;
  return n;
}

/**
 * The weight she put on the WHOLE entry, or null.
 *
 * Only a weight at the very start counts, and only when the entry describes one
 * dish. "50g cheese omelette" states the dish's weight; "omelette with 50g of
 * cheese" states an ingredient's, and "toast and 50g cheese" describes two
 * things of which one is weighed. Anything with a joining word after the
 * weighed phrase is left alone, because the weight plainly belongs to one part.
 */
export function statedDishWeight(entryText: string | null | undefined): number | null {
  if (!entryText) return null;
  const text = String(entryText).trim().toLowerCase();

  // It has to open with the weight. A weight in the middle belongs to whatever
  // it sits beside.
  const opening = text.match(/^(?:about\s+|approx\.?\s+|around\s+|~)?(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|oz|ounces?)\b\s*(?:of\s+)?(.*)$/);
  if (!opening) return null;

  const rest = opening[3].trim();
  if (!rest) return null;

  // MORE THAN ONE THING WAS DESCRIBED, so the weight is not the total. Her own
  // morning entry - "100g cheesy omelette and half a corn on the cob" - is
  // exactly this case, and rescaling it to 100g would have been the same kind
  // of wrongness in the other direction.
  if (/\b(and|with|plus|,|\+)\b|,/.test(rest)) return null;

  return gramsIn(`${opening[1]}${opening[2]}`);
}

/** What the model's own items weigh, where they say. */
export function itemsWeight(items: ParsedItem[] | undefined): { grams: number; stated: number; of: number } {
  let grams = 0;
  let stated = 0;
  const of = items?.length ?? 0;
  for (const it of items ?? []) {
    const g = gramsIn(it.quantity) ?? gramsIn(it.name);
    if (g != null) {
      grams += g;
      stated += 1;
    }
  }
  return { grams, stated, of };
}

export type WeightCheck =
  | { rescaled: false }
  | { rescaled: true; statedGrams: number; itemGrams: number; factor: number };

/**
 * How much of the model's answer is too much for the weight she gave.
 *
 * A margin, because an estimate of what two eggs weigh is an estimate. It is
 * generous on purpose: this exists to catch a reading that attached the weight
 * to the wrong noun - which is out by a factor, not by a fifth - and never to
 * second-guess a plausible portion.
 */
const TOO_MUCH = 1.4;

export function checkStatedWeight(entryText: string | null | undefined, macros: ParsedMacros): WeightCheck {
  const statedGrams = statedDishWeight(entryText);
  if (statedGrams == null) return { rescaled: false };

  const { grams, stated, of } = itemsWeight(macros.items);
  // EVERY ITEM HAS TO SAY WHAT IT WEIGHS, or the sum is not a sum. One weighed
  // item out of three tells us nothing about the total.
  if (of === 0 || stated < of || grams <= 0) return { rescaled: false };

  if (grams <= statedGrams * TOO_MUCH) return { rescaled: false };

  return { rescaled: true, statedGrams, itemGrams: grams, factor: statedGrams / grams };
}

/** Every macro on a log and its items, scaled by the same factor. */
export function scaleMacros(macros: ParsedMacros, factor: number): ParsedMacros {
  const scale = (v: number | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v * factor) : v;
  return {
    ...macros,
    kcal: scale(macros.kcal),
    protein_g: scale(macros.protein_g),
    carbs_g: scale(macros.carbs_g),
    fat_g: scale(macros.fat_g),
    sodium_mg: scale(macros.sodium_mg),
    items: macros.items?.map((it) => ({
      ...it,
      kcal: scale(it.kcal),
      protein_g: scale(it.protein_g),
      carbs_g: scale(it.carbs_g),
      fat_g: scale(it.fat_g),
      sodium_mg: scale(it.sodium_mg),
    })),
  };
}
