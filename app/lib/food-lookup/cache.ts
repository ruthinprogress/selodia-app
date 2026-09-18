import type { SupabaseClient } from '@supabase/supabase-js';

import { normaliseFoodName } from './normalise';

// TIER 1: the personal food cache (Part Eleven).
//
// Foods somebody has logged before, returned without asking the model again.
// "A banana logged fifty times costs fifty API calls and the answer never
// changes."
//
// WHAT HER OWN DATA SAID WHEN THIS WAS MEASURED (2026-09-18, 55 entries). Only
// 9% of descriptions repeated at all, and NOT ONE of the repeats was a food: two
// were the duplicate-logging bug fixed the same day, and the third was
// "(photo upload)" - the placeholder every photo log carries - appearing three
// times at 165, 285 and 520 kcal. A cache keyed on the description would have
// answered the 520 kcal meal with 165.
//
// So this file exists, is tested, and IS NOT WIRED IN. See lookupFoodEntry in
// ./index.ts for the switch and the reasoning. The guard below is the part worth
// keeping whatever happens next: some descriptions are not descriptions.

// NEVER CACHEABLE, however often they repeat. A placeholder stands for a
// different meal every time it is used, which is precisely what makes it a
// placeholder.
const PLACEHOLDERS = [
  'photo upload',
  'photo',
  'image',
  'picture',
  'see photo',
  'attached',
];

export function isCacheable(rawText: string): boolean {
  const key = normaliseFoodName(rawText);
  if (key.length < 3) return false;
  if (PLACEHOLDERS.includes(key)) return false;
  // A sentence about a day is not a food, even when it contains one. "Had a
  // rough day, just ate a whole tub of ice cream and feel awful" is in her log
  // three times; it is a moment, and the next one will not be 1200 kcal.
  if (key.split(' ').length > 12) return false;
  return true;
}

export type CachedFood = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sodium_mg: number | null;
  source: string;
  confidence: number;
};

/** An earlier answer for exactly this description, or null. */
export async function readCache(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
  minConfidence = 0.85
): Promise<CachedFood | null> {
  if (!isCacheable(rawText)) return null;
  const key = normaliseFoodName(rawText);

  // EXACT KEY ONLY, deliberately. The spec allows a fuzzy match at 0.85, and
  // fuzzy is where a cache turns into a guess: "chicken salad" and "chicken
  // salad sandwich" are 0.86 similar and 400 kcal apart.
  const { data, error } = await supabase
    .from('food_cache')
    .select('kcal, protein_g, carbs_g, fat_g, sodium_mg, source, confidence')
    .eq('user_id', userId)
    .eq('food_name', key)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as CachedFood;
  if (row.confidence < minConfidence) return null;
  return row;
}

/** Remember what was stored for this description, for next time. */
export async function writeCache(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
  macros: Omit<CachedFood, 'confidence'> & { confidence?: number }
): Promise<void> {
  if (!isCacheable(rawText)) return;
  const key = normaliseFoodName(rawText);
  const { error } = await supabase.from('food_cache').upsert(
    {
      user_id: userId,
      food_name: key,
      kcal: macros.kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      sodium_mg: macros.sodium_mg,
      source: macros.source,
      confidence: macros.confidence ?? 0.9,
      last_used: new Date().toISOString(),
    },
    { onConflict: 'user_id,food_name' }
  );
  if (error) console.log('food_cache write failed (non-fatal):', error.message);
}
