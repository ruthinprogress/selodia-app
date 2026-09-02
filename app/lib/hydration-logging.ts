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

  const explicit = /(\d+(?:\.\d+)?)\s*(ml|l|litres?|liters?)\b/.exec(t);
  if (explicit) {
    const n = Number(explicit[1]);
    if (!isFinite(n) || n <= 0) return null;
    return explicit[2] === 'ml' ? n : n * 1000;
  }

  const counted = /(\d+(?:\.\d+)?|a|an|another)\s*(glass(?:es)?|mugs?|cups?|pints?|bottles?)\b/.exec(t);
  if (counted) {
    const raw = counted[1];
    const count = raw === 'a' || raw === 'an' || raw === 'another' ? 1 : Number(raw);
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
  return `Logged · ${ml >= 1000 ? `${Math.round(ml / 100) / 10}L` : `${ml}ml`}`;
}
