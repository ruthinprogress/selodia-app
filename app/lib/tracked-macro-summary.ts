import type { SupabaseClient } from '@supabase/supabase-js';

// THE MACROS SHE SWITCHED ON, PUT IN FRONT OF THE MODEL (2026-10-04).
//
// ---------------------------------------------------------------------------
// WRITTEN IN THE SECOND PERSON SINCE 5 OCTOBER 2026, and that is not a style
// note. Ruth, 20:38 tonight, asked about her saturated fat and was told twice
// that the log does not hold it. The second refusal read:
//
//   "What I can see from HER log is calories and protein."
//
// Her saturated fat was in the database all along: 46 of her last 53 meals carry
// a figure, 309 g across the fortnight, and she had the macro switched on. The
// block below was built, and it was the newest and most emphatic thing in the
// context - so the model took its register from it and answered about a third
// party it had been told about rather than the person who was typing.
//
// A PROMPT THAT SAYS "SHE" TEACHES THE MODEL TO SAY "SHE". It also leaves the
// model to work out that the "she" in the context and the "I" in the message are
// the same person, which it does not reliably do - and getting that wrong looks
// exactly like not having the data. Ruth: "this is basic stuff it's failing
// on."
//
// So every line of model-visible text here addresses her directly, and
// check-second-person.mjs fails the build on a third-person pronoun in any
// string the model can see.
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
//
// AND THE SWITCH WAS OFF WHEN SHE ASKED (her correction, same evening): "I
// switched them on after the chat said it wasn't seeing them, but she should
// have told me they were available and suggested i turn them on."
//
// She is right, and it makes the original answer worse rather than better. The
// toggle has NEVER gated capture - tracked_macros appears nowhere in the parse
// or in food-logging, so saturated fat has been measured on every meal she has
// ever logged. "What I track" decides what is SHOWN on a row, not what is kept.
// So "that's not something your record tracks" was false with the switch off
// exactly as it was with it on, and the honest answer was always "I do have
// that - it is not switched on, shall I show it?".
//
// SO AN UNTRACKED MACRO IS NAMED, NOT TOTALLED. Naming it tells the truth about
// what exists and offers her the switch. Printing the figures anyway would
// override a setting she is entitled to have meant - she turned these off, or
// never turned them on, and a direct question is not permission to start
// rendering a nutrition label at her. The offer is the respectful shape: it
// costs her one tap and it never pretends.

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
  // EVERY COLUMN IS READ, NOT ONLY THE SWITCHED-ON ONES, because the block has
  // to be able to say "I have this and it is not switched on". Same rows either
  // way; the cost is a few more fields on a query that was already happening.
  const allKeys = Object.keys(MACRO_COLUMN);
  const columns = allKeys.map((k) => MACRO_COLUMN[k].column);
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
    for (const key of allKeys) {
      const v = row[MACRO_COLUMN[key].column];
      if (typeof v === 'number') totals[key] = (totals[key] ?? 0) + v;
    }
    byDay.set(day, totals);
  }
  if (byDay.size === 0) return '';

  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  // Which of the switched-off ones she actually has figures for. A macro the
  // parse never managed to estimate is not something to offer her.
  const available = allKeys.filter(
    (k) => !keys.includes(k) && days.some(([, t]) => t[k] != null)
  );

  const sections: string[] = [];

  if (keys.length > 0) {
    const lines = days.map(([day, totals]) => {
      const parts = keys
        .filter((k) => totals[k] != null)
        .map((k) => `${Math.round(totals[k])}${MACRO_SUMMARY_UNIT(k)} ${MACRO_COLUMN[k].label}`);
      return `  ${day}: ${parts.length > 0 ? parts.join(', ') : 'nothing recorded'}`;
    });
    const names = keys.map((k) => MACRO_COLUMN[k].label).join(', ');
    sections.push(
      `WHAT YOU TRACK, BY DAY (computed by the app from your own log - never recalculate these).\n` +
        `You have switched these on in "What I track": ${names}. They are recorded on every meal ` +
        `you log, so when you ask about any of them I HAVE the figures and must answer from ` +
        `them. Totals are the sum of your logged meals, so they are as complete as your logging ` +
        `that day and no more - say so if it matters, but do not use it to avoid answering.\n` +
        lines.join('\n')
    );
  }

  if (available.length > 0) {
    const names = available.map((k) => MACRO_COLUMN[k].label).join(', ');
    sections.push(
      `ALSO RECORDED, BUT NOT SWITCHED ON: ${names}. Every meal you log is measured for ` +
        `these whether or not they are switched on - "What I track" decides what is SHOWN on ` +
        `a row, never what is kept. So if you ask about any of them, say plainly that I DO ` +
        `have it and offer to switch it on for you in Profile > What I track, where the past ` +
        `weeks will then show too. NEVER say your record does not track it, never say there is ` +
        `nothing to show for a past window, and never send you to your GP or another app for a ` +
        `figure this one is holding. Do not quote the daily numbers for these until you have ` +
        `said yes - you have not asked to see them on your rows, and the offer is the answer.`
    );
  }

  if (sections.length === 0) return '';
  return `\n\n${sections.join('\n\n')}`;
}

function MACRO_SUMMARY_UNIT(key: string): string {
  return MACRO_COLUMN[key].unit === 'mg sodium' ? 'mg' : 'g';
}
