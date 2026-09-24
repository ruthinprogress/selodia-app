import type { SupabaseClient } from '@supabase/supabase-js';

import { readCache, writeCache } from './cache';
import { lookupWeighedFromComposition } from './composition';
import { isSingleWeighedFood } from './normalise';
import { lookupWeighedEntry } from './open-food-facts';

export { isCacheable, readCache, writeCache } from './cache';
export { lookupComposition, lookupWeighedFromComposition, scoreComposition } from './composition';
export {
  foodWithoutQuantity,
  isSingleWeighedFood,
  normaliseFoodName,
  readQuantity,
} from './normalise';
export { lookupFood, lookupWeighedEntry, scaleToQuantity, scoreMatch } from './open-food-facts';

// THE HYBRID FOOD LOOKUP, assembled (Part Eleven, built 2026-09-18).
//
// Tier 1 is the person's own cache, tier 2 is Open Food Facts, tier 3 is the
// model - which is what happens today and what happens whenever the first two
// decline. The person never sees which tier answered; that is the point.
//
// TIER 2 IS THE GOVERNMENT'S TABLE FIRST, THE PRODUCT API SECOND - which
// reverses the spec's order, on evidence gathered the day this was built. Open
// Food Facts is a database of PACKAGED PRODUCTS: asked for "100g cheddar" it
// answered "Mature Cheddar & Chive", 469 kcal and 6.9g protein, and would have
// logged it; five of six ordinary foods got nothing usable from it at all.
// McCance and Widdowson answers the same question with "Cheese, Cheddar,
// English", 416 kcal and 25.4g, from a local table with no network in the way.
// The API keeps its place for packaged items, where it is genuinely better.
//
// IT IS BUILT AND IT IS SWITCHED OFF. Not because it is unfinished, but because
// it was measured against Ruth's own 55 food logs before being trusted with
// them, and the measurement said no:
//
//   - 7% of her entries are a single weighed food, which is the only shape
//     tier 2 can honestly answer. The spec projected 50-60% of logs hitting
//     tiers 1 or 2.
//   - 9% of descriptions repeat, and NONE of the repeats is a food. Two were the
//     duplicate-logging bug fixed the same day; the third was "(photo upload)",
//     the placeholder every photo log carries, three times at 165, 285 and 520
//     kcal. A cache would have answered the 520 kcal meal with 165.
//
// The reason is in how she writes: "Tin of sardines in brine, 60g lettuce, 50g
// grapes, 80g beetroot puree, spoon of garlic olive oil". Real meals described
// in full sentences do not repeat verbatim and are not one weighed food. The
// spec's saving assumed a person who logs "a banana"; the app is used by people
// who log dinner.
//
// SO THE SWITCH STAYS OFF until the evidence changes, and it is one environment
// variable rather than a branch that rots. Re-run scripts/measure-food-lookup.mjs
// when there are more users or more logs; if the numbers move, turn it on.
//
// WHAT WOULD MAKE IT WORTH IT. Tier 1 answering repeated STAPLES rather than
// repeated sentences - which needs the model to name the items it parsed, not
// the sentence they came in, and food_items already stores exactly that. That is
// the next honest version of this idea, and it is a different build.

export const FOOD_LOOKUP_ENABLED = process.env.FOOD_LOOKUP_TIERS === 'on';

export type LookupResult = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sodium_mg: number | null;
  // Null from the Open Food Facts branch, which is not asked for them, and
  // often null from CoFID, which did not measure every food. Optional would be
  // the wrong type here: the caller must see an explicit "not known".
  saturated_fat_g: number | null;
  sugar_g: number | null;
  fibre_g: number | null;
  source: string;
  confidence: number;
  tier: 1 | 2;
};

/**
 * Tier 1 then tier 2, or null when the model should answer.
 *
 * Returns null whenever it is switched off, so a caller needs no flag of its
 * own: today it always returns null, and that is the behaviour the app has.
 */
export async function lookupFoodEntry(
  supabase: SupabaseClient,
  userId: string,
  rawText: string
): Promise<LookupResult | null> {
  if (!FOOD_LOOKUP_ENABLED) return null;

  const cached = await readCache(supabase, userId, rawText);
  if (cached) {
    return { ...cached, tier: 1 };
  }

  if (!isSingleWeighedFood(rawText)) return null;

  // The government's table first: local, authoritative for whole foods, and
  // right about the ones the product API got wrong.
  const found =
    (await lookupWeighedFromComposition(supabase, rawText)) ?? (await lookupWeighedEntry(rawText));
  if (!found) return null;

  // The Open Food Facts branch returns four macros and no more, so the three
  // are read off it as undefined and normalised to null once, here, rather than
  // left to every caller to remember.
  const extra = {
    saturated_fat_g: 'saturated_fat_g' in found ? (found.saturated_fat_g ?? null) : null,
    sugar_g: 'sugar_g' in found ? (found.sugar_g ?? null) : null,
    fibre_g: 'fibre_g' in found ? (found.fibre_g ?? null) : null,
  };

  // Remembered as the person's own, so the second time costs nothing at all.
  await writeCache(supabase, userId, rawText, {
    kcal: found.kcal,
    protein_g: found.protein_g,
    carbs_g: found.carbs_g,
    fat_g: found.fat_g,
    sodium_mg: found.sodium_mg,
    ...extra,
    source: found.source,
    confidence: found.confidence,
  });

  return { ...found, ...extra, tier: 2 };
}
