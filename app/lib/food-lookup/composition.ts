import type { SupabaseClient } from '@supabase/supabase-js';

import { foodWithoutQuantity, readQuantity } from './normalise';
import { scaleToQuantity } from './open-food-facts';

// TIER 2, THE PART THAT ACTUALLY WORKS: McCance and Widdowson (CoFID).
//
// 2,886 foods measured by UKHSA, per 100g, held locally in food_composition. No
// network, no rate limit, no key, and authoritative for the whole foods people
// actually describe.
//
// WHY THIS LEADS AND OPEN FOOD FACTS FOLLOWS (measured 2026-09-18). Asked for
// "100g cheddar", Open Food Facts returned "Mature Cheddar & Chive" at 469 kcal
// and 6.9g protein, and would have logged it. CoFID returns "Cheese, Cheddar,
// English" at 416 kcal and 25.4g. One is a branded product that happens to share
// a word; the other is the food. Five of six ordinary foods got nothing usable
// from the API at all.
//
// So the order in the spec is reversed: whole foods here first, and the product
// database kept for packaged items, where it is genuinely the better source.
//
// MATCHING IS DONE IN TWO STEPS because CoFID inverts its names - "Cheese,
// Cheddar, English", "Potatoes, new, boiled in unsalted water". Trigram
// similarity alone ranks "cheese" above "cheddar" for a query of "cheddar", so
// the database returns a shortlist and the scoring below decides on whole words.

export type CompositionRow = {
  code: string;
  name: string;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  sodium_mg: number | null;
  similarity: number;
};

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

// WORDS THAT DESCRIBE HOW IT WAS COOKED, and which therefore must agree. Boiled
// potatoes and roast potatoes are 80 kcal apart per 100g; a match that ignores
// the cooking word is not a match.
const PREPARATION = new Set([
  'raw', 'boiled', 'fried', 'roast', 'roasted', 'baked', 'grilled', 'steamed',
  'poached', 'dried', 'canned', 'frozen', 'smoked', 'stewed', 'microwaved',
]);

// WORDS IN A CoFID NAME THAT CHANGE THE NUMBERS, and which the person must
// therefore have said themselves before a row carrying them can be their food.
//
// EVERY ONE OF THESE COMES FROM A WRONG ANSWER THIS MATCHER ACTUALLY GAVE
// (2026-09-18, tested against the live table):
//   "150g chicken breast" -> "Chicken breast/steak, COATED, baked", 351 kcal.
//       Plain chicken breast is about 222 for that weight. Half as much again.
//   "80g basmati rice"    -> "Rice, BROWN, basmati, RAW", 284 kcal.
//       Raw rice weighs a third of what it weighs cooked. Nobody logs dry rice.
//   "60g homemade banana pancake" -> "Banana BREAD, homemade", scored 0.67.
//       Not the same food at all.
//
// The rule is deliberately blunt and deliberately biased toward refusing: a food
// sent to the model costs a fraction of a penny, and a wrong one sits in
// somebody's record for good.
const MATERIAL = new Set([
  // cooked or not - the single biggest error, because dry weight is not eaten
  'raw', 'dry', 'dried', 'uncooked', 'undiluted', 'concentrate', 'powder',
  // what has been added
  'coated', 'breaded', 'battered', 'sweetened', 'salted', 'oil', 'syrup', 'brine',
  'butter', 'sauce', 'icing', 'chocolate',
  // which version of it
  'brown', 'wholemeal', 'wholegrain', 'skimmed', 'semi', 'reduced', 'half',
  'fortified', 'diet', 'light', 'lite',
  // a different food that shares a word
  'bread', 'cake', 'biscuit', 'biscuits', 'crisps', 'juice', 'soup', 'pie',
]);

/**
 * How well a CoFID row answers what somebody wrote. 0 to 1.
 *
 * Every word of the query should appear in the food's name; a name that adds a
 * great deal the person never said is a more specific food than they described.
 * A preparation word in the query that the name contradicts is disqualifying,
 * and so is a material qualifier in the name that the query never asked for.
 */
export function scoreComposition(query: string, name: string): number {
  const q = words(query);
  const n = new Set(words(name));
  if (q.length === 0 || n.size === 0) return 0;

  const askedPrep = q.filter((w) => PREPARATION.has(w));
  const namePrep = [...n].filter((w) => PREPARATION.has(w));
  // She said boiled and this row says fried: not this food, whatever else agrees.
  if (askedPrep.length > 0 && namePrep.length > 0) {
    if (!askedPrep.some((w) => n.has(w))) return 0;
  }

  // Anything material in the name that she did not say is a different food.
  const asked = new Set(q);
  for (const w of n) {
    if (MATERIAL.has(w) && !asked.has(w)) return 0;
  }

  // THE THING ITSELF MUST BE THERE. English puts the head noun last - "banana
  // PANCAKE", "basmati RICE", "chicken BREAST" - and everything before it is a
  // modifier. Without this rule "60g homemade banana pancake" matched "Banana
  // split, homemade" at 0.67 and would have logged an ice cream: two words in
  // three agreed, and the one that disagreed was the food.
  const head = [...q].reverse().find((w) => !PREPARATION.has(w));
  if (head && !n.has(head)) return 0;

  let hits = 0;
  for (const w of q) if (n.has(w)) hits++;
  const covered = hits / q.length;
  const explained = hits / n.size;
  // Coverage dominates: a long official name that contains everything asked for
  // ("Cheese, Cheddar, English" for "cheddar") is a good answer, not a bad one.
  return covered * 0.8 + explained * 0.2;
}

/** The best CoFID match for a food description, or null. */
export async function lookupComposition(
  supabase: SupabaseClient,
  food: string,
  minScore = 0.6
): Promise<{ row: CompositionRow; score: number } | null> {
  const { data, error } = await supabase.rpc('match_food_composition', { q: food, n: 20 });
  if (error) {
    console.log('CoFID match failed (non-fatal):', error.message);
    return null;
  }
  const rows = (data ?? []) as CompositionRow[];

  let best: { row: CompositionRow; score: number } | null = null;
  for (const row of rows) {
    // A row with no energy cannot answer a food log.
    if (row.kcal == null || row.protein_g == null) continue;
    const score = scoreComposition(food, row.name);
    if (!best || score > best.score) best = { row, score };
  }

  if (!best || best.score < minScore) return null;
  return best;
}

/** Tier 2 for one weighed entry, from the government's own table. */
export async function lookupWeighedFromComposition(supabase: SupabaseClient, rawText: string) {
  const quantity = readQuantity(rawText);
  const food = foodWithoutQuantity(rawText);
  if (!quantity || !('grams' in quantity) || !food) return null;

  const match = await lookupComposition(supabase, food);
  if (!match) return null;

  const per100 = {
    kcal: match.row.kcal ?? 0,
    protein_g: match.row.protein_g ?? 0,
    carbs_g: match.row.carbs_g ?? 0,
    fat_g: match.row.fat_g ?? 0,
    sodium_mg: match.row.sodium_mg,
  };

  return {
    ...scaleToQuantity(per100, quantity.grams),
    source: 'mcwiddowson' as const,
    confidence: match.score,
    matchedName: match.row.name,
  };
}
