import type { SupabaseClient } from '@supabase/supabase-js';

// THE SAME FOOD, COUNTED THE SAME WAY (food lookup v2, built 2026-09-19).
//
// The hybrid lookup (lib/food-lookup) was built to skip the model for foods
// somebody logs again, and is switched off because her own logs said it would
// almost never fire: whole descriptions do not repeat. Measured again at the
// item level the same day, 47 items across her logs: five foods appeared more
// than once. Skipping the model for those would save next to nothing.
//
// BUT ONE OF THE FIVE SHOWED WHAT DOES GO WRONG. "1 spoon" of peanut butter was
// stored as 95 kcal and 4.2g protein one time, and 60 kcal and 1g the next -
// the same food, the same amount, a day apart, counted two ways because each
// parse starts from nothing. Across a month that is noise in every average, and
// the first time somebody notices, it is a reason not to trust any of it.
//
// So this does not skip the model. It gives the model her own last value for
// every food in the new entry that she has logged before, and asks it to use
// that value for the same amount and scale it for a different one. The model
// still reads the sentence, splits the meal and handles everything new; what
// changes is that a staple stops drifting. The most recent value is the one
// kept, so a correction she made is the value that sticks.
//
// Per person, always: the read is her own rows (RLS, and filtered by user_id
// as well). One person's peanut butter is never another's.

/** How far back a remembered value is trusted. */
export const FOOD_MEMORY_DAYS = 180;
/** At most this many reference lines in one prompt. */
export const FOOD_MEMORY_MAX = 12;
/**
 * Values younger than this are not offered. Found the day memory shipped: a
 * chocolate logged at 240 kcal was corrected twenty minutes later to "one tiny
 * caramel the size of a Malteser", and the re-log came back at 240 again -
 * memory handed the model the very number she was correcting. Consistency is
 * a between-days problem; within a day, the latest estimate may be the wrong
 * one still being put right.
 */
export const FOOD_MEMORY_SETTLE_HOURS = 12;

export type RememberedFood = {
  name: string;
  quantity: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
};

// Names that are not a food, however often they are stored. A reference line
// for "dinner" would hand a whole meal's calories to anything called dinner.
const NOT_A_FOOD = new Set([
  'item', 'items', 'food', 'meal', 'snack', 'snacks', 'dinner', 'lunch', 'breakfast',
  'other', 'misc', 'leftovers', 'photo', 'unknown',
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 0)
    // Plural-tolerant, and nothing more clever than that: "bananas" is a
    // banana, but "chips" must not become "chip" by any rule that also turns
    // "hummus" into "hummu" - so only a plain trailing s on a longer word.
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') ? w.slice(0, -1) : w));
}

/**
 * Of everything she has logged, the foods that appear in this new text - one
 * value each, the most recent. Pure, so it is testable: scripts/probe-food-memory.mjs.
 *
 * A NAME MATCHES ONLY AS A WHOLE PHRASE. "butter" is not found in "buttermilk",
 * and once "peanut butter" has claimed its words, the "butter" inside it is not
 * found a second time - only a separate mention of butter would be.
 */
export function pickRemembered(rows: RememberedFood[], text: string): RememberedFood[] {
  const target = words(text);
  if (target.length === 0) return [];

  // Most recent first, one per name.
  const latest = new Map<string, RememberedFood>();
  const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const row of sorted) {
    const key = words(row.name).join(' ');
    if (key.length < 3 || NOT_A_FOOD.has(key)) continue;
    if (typeof row.kcal !== 'number' || !Number.isFinite(row.kcal)) continue;
    if (!latest.has(key)) latest.set(key, row);
  }

  // Longest names claim their words first.
  const candidates = [...latest.entries()].sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);
  const claimed = new Array<boolean>(target.length).fill(false);
  const picked: RememberedFood[] = [];

  for (const [key, row] of candidates) {
    const need = key.split(' ');
    for (let i = 0; i + need.length <= target.length; i++) {
      let ok = true;
      for (let j = 0; j < need.length; j++) {
        if (claimed[i + j] || target[i + j] !== need[j]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let j = 0; j < need.length; j++) claimed[i + j] = true;
      picked.push(row);
      break;
    }
    if (picked.length >= FOOD_MEMORY_MAX) break;
  }
  return picked;
}

function num(v: number | null): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}

/** The prompt block, or an empty string when nothing she has logged is in the text. */
export function rememberedFoodsBlock(picked: RememberedFood[]): string {
  if (picked.length === 0) return '';
  // IN THE SHAPE THE MODEL WRITES BACK, NOT IN PROSE. The first version read
  // "95 kcal, 4.2g protein", and on the first live run the model copied the
  // unit straight into its answer - "protein_g": 8g - which is not JSON, and
  // the whole entry failed to save. Plain numbers under the schema's own field
  // names give it nothing to copy wrongly.
  const lines = picked.map((r) =>
    JSON.stringify({
      name: r.name.trim(),
      quantity: r.quantity && r.quantity.trim() ? r.quantity.trim() : null,
      kcal: num(r.kcal),
      protein_g: num(r.protein_g),
      carbs_g: num(r.carbs_g),
      fat_g: num(r.fat_g),
    })
  );
  return (
    ' FOODS THIS PERSON HAS LOGGED BEFORE, with the values stored for them last time: ' +
    lines.join(' ') +
    ' When one of these foods appears in this entry, count it the same way: the same value for the same amount, scaled in proportion for a different amount. The same food must never be counted two different ways. Depart from it only when they describe it differently this time - a different brand, size, recipe or way of cooking it. These are reference values, not things they ate: never add a food from this list that they did not mention now.'
  );
}

/** Her remembered foods that appear in this text, read from her own items. */
export async function loadRememberedFoods(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<RememberedFood[]> {
  if (!text || !text.trim()) return [];
  const since = new Date(Date.now() - FOOD_MEMORY_DAYS * 86_400_000).toISOString();
  const settled = new Date(Date.now() - FOOD_MEMORY_SETTLE_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('food_items')
    .select('name, quantity, kcal, protein_g, carbs_g, fat_g, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .lt('created_at', settled)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    // Never a reason not to log: without a memory the parse is what it was.
    console.log('food memory read failed (non-fatal):', error.message);
    return [];
  }
  return pickRemembered((data ?? []) as RememberedFood[], text);
}
