import type { SupabaseClient } from '@supabase/supabase-js';

// THE MACROS SHE SWITCHED ON, PUT IN FRONT OF THE MODEL (2026-10-04).
//
// Ruth asked: "What about saturated fat in the past week?" and was told "That's
// not something your record tracks - I've got calories and protein logged, but
// no breakdown of fat types. If it matters to you, your GP or a food diary with
// that detail would be the place to look."
//
// EVERY WORD OF THAT WAS WRONG. Every food row she has logged since 27 September
// carries a saturated_fat_g: 38g on the Sunday pizza, 29.6g on the four-egg
// cheesy omelette, 12g on Saturday's fish and chips. She had also switched all
// six optional macros on in "What I track" - fat, saturated, carbs, sugar,
// fibre, salt - which the app stored in user_profile.tracked_macros.
//
// The parse captured it. The column held it. The setting recorded that she
// wanted it. And NOTHING ON THE SERVER HAS EVER READ EITHER ONE: the food handed
// to the model is built as
//
//     raw_text + ' (' + kcal + 'kcal, ' + protein_g + 'g protein)'
//
// so the other six figures were on the row and never on the page. Asked about a
// number it could not see, the model did not say "I cannot see that" - it said
// her record does not keep it, and sent her to her GP.
//
// THAT IS THE SAME FAULT AS THE DUPLICATE GUARD AND THE NAMED DAY, FOUND THE
// SAME DAY: a thing is collected, stored, and read by nobody. The difference is
// which way the silence points. Those two made a present thing unreachable; this
// one made a present thing sound absent, which is worse, because she acted on
// it - she went and switched on a setting that was already on.
//
// WHY DAILY TOTALS RATHER THAN EVERY MEAL. She asked about a week. Seven lines
// answer that; sixty meals with eight figures each is a nutrition label, and a
// nutrition label is the thing this app exists to stop her reading. The per-meal
// figures are already one tap away in her log.

/** Mirrors mobile/src/lib/tracked-macros.ts. Calories and protein are never toggles. */
const MACRO_COLUMN: Record<string, { column: string; label: string; unit: string }> = {
  fat: { column: 'fat_g', label: 'fat', unit: 'g' },
  saturated: { column: 'saturated_fat_g', label: 'saturated fat', unit: 'g' },
  carbs: { column: 'carbs_g', label: 'carbs', unit: 'g' },
  sugar: { column: 'sugar_g', label: 'sugar', unit: 'g' },
  fibre: { column: 'fibre_g', label: 'fibre', unit: 'g' },
  salt: { column: 'sodium_mg', label: 'salt', unit: 'mg sodium' },
};

export const MACRO_SUMMARY_DAYS = 14;

export function trackedMacroKeys(stored: unknown): string[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter((k): k is string => typeof k === 'string' && k in MACRO_COLUMN);
}

/**
 * A block of daily totals for the macros she has switched on, or '' when she has
 * switched none on - in which case there is genuinely nothing to say and the
 * model should not be told there is.
 *
 * ONE READ, AND ONLY THE COLUMNS SHE ASKED FOR. A person tracking nothing
 * optional pays for no query at all.
 */
export async function buildTrackedMacroBlock(
  supabase: SupabaseClient,
  userId: string,
  trackedMacrosStored: unknown,
  now: Date = new Date()
): Promise<string> {
  const keys = trackedMacroKeys(trackedMacrosStored);
  if (keys.length === 0) return '';

  const columns = keys.map((k) => MACRO_COLUMN[k].column);
  const since = new Date(now.getTime() - MACRO_SUMMARY_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('food_logs')
    .select(['happened_at', ...columns].join(', '))
    .eq('user_id', userId)
    .gte('happened_at', since)
    .order('happened_at', { ascending: false })
    .limit(400);

  // A FAILED READ SAYS NOTHING RATHER THAN NOTHING-IS-TRACKED. An empty block
  // and a block saying there are no figures are different claims, and only one
  // of them is honest when the query broke.
  if (error || !data || data.length === 0) return '';

  const byDay = new Map<string, Record<string, number>>();
  for (const row of data as unknown as Record<string, unknown>[]) {
    const at = typeof row.happened_at === 'string' ? row.happened_at : null;
    if (!at) continue;
    // The local day, so a 9pm dinner in summer counts to the day she ate it.
    const day = new Date(at).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const totals = byDay.get(day) ?? {};
    for (const key of keys) {
      const v = row[MACRO_COLUMN[key].column];
      if (typeof v === 'number') totals[key] = (totals[key] ?? 0) + v;
    }
    byDay.set(day, totals);
  }
  if (byDay.size === 0) return '';

  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const lines = days.map(([day, totals]) => {
    const parts = keys
      .filter((k) => totals[k] != null)
      .map((k) => `${Math.round(totals[k])}${MACRO_SUMMARY_UNIT(k)} ${MACRO_COLUMN[k].label}`);
    return `  ${day}: ${parts.length > 0 ? parts.join(', ') : 'nothing recorded'}`;
  });

  const names = keys.map((k) => MACRO_COLUMN[k].label).join(', ');
  return (
    `\n\nWHAT SHE TRACKS, BY DAY (computed by the app from her own log - never recalculate these).\n` +
    `She has switched these on in "What I track": ${names}. They are recorded on every meal ` +
    `she logs, so when she asks about any of them you HAVE the figures and must answer from ` +
    `them. Never tell her a macro on this list is not tracked, and never send her elsewhere ` +
    `for it. Totals are the sum of her logged meals, so they are as complete as her logging ` +
    `that day and no more - say so if it matters, but do not use it to avoid answering.\n` +
    lines.join('\n')
  );
}

function MACRO_SUMMARY_UNIT(key: string): string {
  return MACRO_COLUMN[key].unit === 'mg sodium' ? 'mg' : 'g';
}
