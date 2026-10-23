// THE MACROS CANNOT WEIGH MORE THAN THE FOOD.
//
// Ruth, 22 October, logged "80g bakery sausage roll" and then "20g more". What
// her log shows:
//
//   80g bakery sausage roll   280 kcal   9g protein  22g carbs  17g fat  = 48g
//   20g bakery sausage roll   180 kcal   6g protein  14g carbs  11g fat  = 31g
//
// THIRTY-ONE GRAMS OF MACRONUTRIENT IN A TWENTY GRAM FOOD. That is not a
// nutrition opinion anybody has to adjudicate; it is impossible, in the way
// that a two-litre jug holding three litres is impossible. The same roll came
// out at 3.5 kcal/g the first time and 9.0 kcal/g the second - 9.0 being the
// energy density of pure fat, which a sausage roll is not.
//
// WHAT ACTUALLY WENT WRONG: the stated weight was ignored. The estimate is for
// a portion of sausage roll somebody would normally eat, wearing the label
// "20g". The arithmetic inside it is self-consistent - 6x4 + 14x4 + 11x9 = 179,
// which matches the 180 kcal - so every check that tests macros against calories
// passes. It is consistent and it is about the wrong amount of food.
//
// WHY THIS IS A CHECK AND NOT A PROMPT RULE. The prompt is being told as well.
// But a prompt rule cannot be verified afterwards, and this exact class of
// instruction - "respect the number they gave you" - is the kind a model
// follows almost always, which is the hardest kind of failure to notice. The
// arithmetic can be verified every single time, for nothing.
//
// IT DOES NOT CORRECT THE FIGURE, deliberately. Scaling 180 down by 20/31 gives
// 116 kcal, which is less wrong and still invented: the honest comparison is
// the 80g row's own density, which puts 20g nearer 70. Guessing a second number
// to replace a bad first one is how an app ends up confidently wrong instead of
// loudly unsure. This marks the entry so the app can say it is unsure, and
// records it so we can count how often the prompt rule is not enough.

/** A weight in grams stated in the person's own words, or null. */
export function statedGrams(text: string | null | undefined): number | null {
  if (!text) return null;
  // "20g", "20 g", "250grams", "1.5 kg". The LAST one in the string, because
  // "half of a 400g tin" describes the tin and then the portion.
  const matches = [
    ...text.matchAll(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|gram)\b/gi),
  ];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const value = Number(last[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return /^k/i.test(last[2]) ? value * 1000 : value;
}

export type WeightVerdict =
  | { ok: true }
  | {
      ok: false;
      statedG: number;
      macroG: number;
      /** What the app should say, in plain words. Never a replacement figure. */
      note: string;
    };

/**
 * Whether an entry's macros can physically fit inside the weight it claims.
 *
 * A SMALL ALLOWANCE, because this must never fire on a correct entry. Rounding
 * alone can push a 100g food to 101g of macros when each one is reported whole,
 * and a dried or dehydrated food quoted at its dry weight is a real edge. The
 * threshold is 10% over, which leaves the sausage roll - 55% over - caught by a
 * wide margin and anything merely rounded alone.
 */
export function weightIsPossible(
  entryText: string | null | undefined,
  macros: { protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null }
): WeightVerdict {
  const statedG = statedGrams(entryText);
  if (statedG === null) return { ok: true };

  const macroG =
    (macros.protein_g ?? 0) + (macros.carbs_g ?? 0) + (macros.fat_g ?? 0);
  if (macroG <= 0) return { ok: true };

  if (macroG <= statedG * 1.1) return { ok: true };

  return {
    ok: false,
    statedG,
    macroG,
    note:
      `That came out as ${Math.round(macroG)}g of protein, carbs and fat for `
      + `${statedG}g of food, which cannot be right - the figures look like a bigger `
      + 'portion than the one you gave. Worth checking that entry.',
  };
}
