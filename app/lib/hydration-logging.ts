import type { SupabaseClient } from '@supabase/supabase-js';

// Water logging (Part Twelve, build item 31), on the same silent-log pattern as
// food and activity: the person says it, the app stores it, and a brief toast
// confirms - the reply never announces it.
//
// Volumes are parsed in CODE, not by the model. "How big is a pint" is a fixed
// fact with a right answer and no open-ended tail, which is the opposite of the
// case principle 13 argues for handing to a model. The open-ended judgement -
// "is this message about a drink at all" - is exactly what the model already
// decides when it sets logIntent.

const GLASS_ML = 250;
const MUG_ML = 300;
const PINT_ML = 568;
const BOTTLE_ML = 500;

export function parseVolumeMl(text: string): number | null {
  const t = text.toLowerCase();

  // "lt" and "ltr" are here because she types them (2026-09-21: "1lt water"
  // logged nothing). Without them "1lt" fell past this to the no-quantity
  // default and would have become a single glass - a litre recorded as 250ml is
  // worse than a litre recorded as nothing, because nobody would notice.
  const explicit = /(\d+(?:\.\d+)?)\s*(mls?|l|lts?|ltrs?|litres?|liters?)\b/.exec(t);
  if (explicit) {
    const n = Number(explicit[1]);
    if (!isFinite(n) || n <= 0) return null;
    return explicit[2].startsWith('ml') ? n : n * 1000;
  }

  // WRITTEN NUMBERS, because people type "two mugs of tea" far more often than
  // "2 mugs of tea" (found 21 September 2026 while fixing Bug 17: "two mugs of
  // tea with milk" was falling all the way through to the one-glass default and
  // recording 250ml instead of 600).
  const WORDS: Record<string, number> = {
    a: 1, an: 1, another: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2,
  };

  const counted = new RegExp(
    String.raw`(\d+(?:\.\d+)?|` + Object.keys(WORDS).join('|') + String.raw`)\s*(?:of\s+)?(glass(?:es)?|mugs?|cups?|pints?|bottles?)\b`
  ).exec(t);
  if (counted) {
    const raw = counted[1];
    const count = WORDS[raw] ?? Number(raw);
    if (!isFinite(count) || count <= 0) return null;
    const unit = counted[2];
    const per = unit.startsWith('pint')
      ? PINT_ML
      : unit.startsWith('mug') || unit.startsWith('cup')
        ? MUG_ML
        : unit.startsWith('bottle')
          ? BOTTLE_ML
          : GLASS_ML;
    return count * per;
  }

  // A drink with no stated quantity is one ordinary glass. A default is right
  // here where it would be wrong for food: the range of plausible answers is
  // narrow, and the cost of being 50ml out on a wellbeing reflection is nil.
  if (/\b(water|tea|coffee|squash|herbal)\b/.test(t)) return GLASS_ML;

  return null;
}

export type HydrationEntry = { id: string; ml: number; happened_at: string };

export async function logHydrationFromText(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<HydrationEntry | null> {
  const ml = parseVolumeMl(text);
  // No volume found means no log, rather than a fabricated default - the same
  // refusal to write an empty row the measurement path makes.
  if (ml == null) return null;

  const { data, error } = await supabase
    .from('hydration_logs')
    .insert({ user_id: userId, ml, raw_input: text })
    .select('id, ml, happened_at');
  if (error) throw new Error('hydration_logs insert failed: ' + error.message);
  return (data?.[0] as HydrationEntry) ?? null;
}

export function hydrationSaveSummary(entry: HydrationEntry): string {
  const ml = Math.round(entry.ml);
  return `Water · ${ml >= 1000 ? `${Math.round(ml / 100) / 10}L` : `${ml}ml`} · Log › Water`;
}
