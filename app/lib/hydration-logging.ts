import type { SupabaseClient } from '@supabase/supabase-js';

import { DRINK_NOUNS } from './caloric-drink';

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

  // A DRINK NAMED WITHOUT A VESSEL, WHICH IS HOW PEOPLE MOSTLY TALK: "three
  // black coffees", "a herbal tea". Two things were wrong here before 22
  // September 2026, and Ruth found them the same evening with one entry:
  //
  //   "Coffee logged in food (thats ok) but wasnt logged in hydration"
  //
  // She had said "three black coffees". The word boundary after `coffee` does
  // not match `coffees`, so the plural fell straight through and the drink was
  // recorded as nothing at all. And even singular, the count was ignored: three
  // coffees and one coffee both came to a single glass.
  //
  // A default volume is right here where it would be wrong for food - the range
  // of plausible answers is narrow, and being 50ml out on a wellbeing figure
  // costs nothing. Silently losing a drink does.
  // THE LIST USED TO BE SEVEN WORDS LONG (23 September 2026). It knew water,
  // tea, coffee, squash, herbal, decaf and brew, and had never heard of a
  // latte, a cappuccino or a flat white. So even once a flat white reached
  // this function it measured as null, which is no hydration row at all.
  //
  // Two separate things had to fail for Ruth's lunch to vanish, and both did:
  // the model left the drink out of its answer, and this parser could not have
  // measured it anyway. The vocabulary now lives in one place, beside the rules
  // about what each drink counts toward.
  const drink = new RegExp(
    String.raw`(^|\s)(` +
      [...DRINK_NOUNS].sort((a, b) => b.length - a.length).map((n) => n.replace(/-/g, '[- ]')).join('|') +
      String.raw`)(s|es)?(?=$|\s)`
  ).exec(t);
  if (drink) {
    const leading = new RegExp(String.raw`^(?:about\s+|approx\.?\s+|around\s+)?(\d+(?:\.\d+)?|` + Object.keys(WORDS).join('|') + String.raw`)\b`).exec(t);
    const count = leading ? (WORDS[leading[1]] ?? Number(leading[1])) : 1;
    if (!isFinite(count) || count <= 0) return GLASS_ML;
    // A sanity ceiling: "20 coffees" is a turn of phrase, not five litres.
    return Math.min(count, 12) * GLASS_ML;
  }

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
