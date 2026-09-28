import type { SupabaseClient } from '@supabase/supabase-js';

// WHAT A DRINK ACTUALLY CONTAINS, from CoFID rather than from a guess.
//
// FOUND 28 September 2026. A half of lager was logged at 180 kcal and 6 g
// protein. CoFID's "Lager, standard" is 24 kcal and 0.3 g per 100 ml, so a
// 284 ml half is 68 kcal and 0.9 g. Calories 2.6 times out; protein SEVEN times.
// A 10 ml splash of whole milk was logged at 2.5 g protein, which is two thirds
// of that item's own calories and about seven times the truth.
//
// WHY DRINKS AND NOT EVERYTHING. The general food lookup exists and is switched
// off, and that decision was right: measured against her real entries on
// 24 September, only 9.5% were the single-weighed-food shape CoFID can answer.
// Drinks are the exception and the reason is structural rather than lucky. A
// standard drink in a standard measure is the ONE thing people describe in terms
// a reference table can match exactly - "a half of lager", "a glass of red", "a
// gin and tonic". Nobody says "a medium portion of lager".
//
// WHY THE MODEL GETS THIS WRONG, which is worth stating because it is not
// carelessness. Alcohol carries about 7 kcal a gram and almost no protein, and
// nothing about the WORDS "half a lager" signals either. A model estimating from
// a name reaches for something beer-shaped and beer-sized, and beer-shaped in
// most of its training data is an American pint. The figures are not wild; they
// are the wrong drink.
//
// THIS IS NOT A PROMPT RULE, deliberately. docs/chat-prompt-history.md records
// five of six incidents where a prompt rule was added and the real cause was a
// missing fact. The fact exists, in her own database, measured by UKHSA. It gets
// passed rather than argued for.

/** Per 100 ml, from CoFID. The name is the exact row so nothing is fuzzy-matched. */
type DrinkRef = {
  /** What the person might say, as a pattern. */
  match: RegExp;
  /** The CoFID row name, exactly. */
  cofid: string;
  /** The measure to assume when they did not say one, in ml. */
  defaultMl: number;
  /** Why that measure, for anybody reading a corrected figure later. */
  measureNote: string;
};

// UK SERVING SIZES, which is the whole reason a default is defensible at all.
// A "half" is 284 ml because a pint is 568 ml by law; a pub single is 25 ml; a
// medium glass of wine is 175 ml. These are not averages, they are the measures
// drinks are actually sold in.
const PINT = 568;
const HALF = 284;

const DRINKS: DrinkRef[] = [
  // Beer and lager. Specific before general, so "strong lager" does not match
  // the plain lager row first.
  { match: /\b(alcohol[- ]free|0%|non[- ]alcoholic)\s+(lager|beer)\b/i, cofid: 'Lager, alcohol-free', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\b(low[- ]alcohol)\s+(lager|beer)\b/i, cofid: 'Lager, low alcohol', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\b(strong|extra strong)\s+lager\b/i, cofid: 'Lager, extra strong', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\b(premium)\s+lager\b/i, cofid: 'Lager, premium', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\blager\b/i, cofid: 'Lager, standard', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\bguinness|stout\b/i, cofid: 'Stout, Guinness', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\b(bitter|ale|real ale)\b/i, cofid: 'Beer, bitter, average (<4% ABV)', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\bshandy\b/i, cofid: 'Shandy, bottled or canned', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\bbeer\b/i, cofid: 'Beer, bitter, average (<4% ABV)', defaultMl: PINT, measureNote: 'a pint' },

  // Cider.
  { match: /\b(dry)\s+cider\b/i, cofid: 'Cider, dry', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\b(strong)\s+cider\b/i, cofid: 'Cider, strong', defaultMl: PINT, measureNote: 'a pint' },
  { match: /\bcider\b/i, cofid: 'Cider, sweet', defaultMl: PINT, measureNote: 'a pint' },

  // Wine. 175 ml is the medium glass, which is what a pub pours unless asked.
  { match: /\b(prosecco|champagne|sparkling wine|cava)\b/i, cofid: 'Wine, white, sparkling', defaultMl: 125, measureNote: 'a 125 ml glass' },
  { match: /\bred wine\b|\bglass of red\b/i, cofid: 'Wine, red', defaultMl: 175, measureNote: 'a 175 ml glass' },
  { match: /\b(ros[eé])\b/i, cofid: 'Wine, rose, medium', defaultMl: 175, measureNote: 'a 175 ml glass' },
  { match: /\bsweet white\b/i, cofid: 'Wine, white, sweet', defaultMl: 175, measureNote: 'a 175 ml glass' },
  { match: /\bwhite wine\b|\bglass of white\b/i, cofid: 'Wine, white, dry', defaultMl: 175, measureNote: 'a 175 ml glass' },
  { match: /\bmulled wine\b/i, cofid: 'Wine, mulled wine, homemade', defaultMl: 175, measureNote: 'a 175 ml glass' },
  { match: /\bwine\b/i, cofid: 'Wine, red', defaultMl: 175, measureNote: 'a 175 ml glass' },

  // Fortified and spirits. A pub single is 25 ml.
  { match: /\bport\b/i, cofid: 'Port', defaultMl: 50, measureNote: 'a 50 ml measure' },
  { match: /\bsherry\b/i, cofid: 'Sherry, medium', defaultMl: 50, measureNote: 'a 50 ml measure' },
  { match: /\b(baileys|cream liqueur)\b/i, cofid: 'Liqueurs, cream', defaultMl: 50, measureNote: 'a 50 ml measure' },
  { match: /\b(gin|vodka|whisky|whiskey|rum|tequila|brandy|bourbon)\b/i, cofid: 'Spirits, 40% volume', defaultMl: 25, measureNote: 'a single, 25 ml' },
];

/** "half a lager", "a pint of", "175ml", "a double" - the measure she actually said. */
function statedMl(text: string, fallback: number): { ml: number; note: string | null } {
  const explicit = /(\d+(?:\.\d+)?)\s*ml\b/i.exec(text);
  if (explicit) return { ml: Number(explicit[1]), note: null };

  if (/\bhalf\b/i.test(text) && /\b(pint|lager|beer|bitter|ale|cider|stout|guinness)\b/i.test(text)) {
    return { ml: HALF, note: 'a half, 284 ml' };
  }
  if (/\bpint\b/i.test(text)) return { ml: PINT, note: 'a pint, 568 ml' };
  if (/\bdouble\b/i.test(text)) return { ml: 50, note: 'a double, 50 ml' };
  if (/\blarge glass\b/i.test(text)) return { ml: 250, note: 'a large glass, 250 ml' };
  if (/\bsmall glass\b/i.test(text)) return { ml: 125, note: 'a small glass, 125 ml' };
  if (/\b(can|bottle)\b/i.test(text)) return { ml: 330, note: 'a 330 ml can' };
  return { ml: fallback, note: null };
}

export type DrinkCorrection = {
  name: string;
  from: { kcal: number | null; protein_g: number | null };
  to: { kcal: number; protein_g: number };
  source: string;
  measure: string;
};

// GENERIC, so the caller keeps its own type. This only reads four fields and
// only writes two, and a narrow local type would have silently dropped carbs,
// fat, sodium and the three 'What I track' figures on their way through.
type Item = { name?: string; quantity?: string; kcal?: number; protein_g?: number };

/**
 * Replace an estimated drink with what CoFID measured.
 *
 * Returns the corrected items and what changed, so the change can be logged and
 * argued with rather than happening invisibly.
 *
 * WHAT IT WILL NOT TOUCH:
 *   - anything that does not match a drink pattern;
 *   - a drink mixed into something else ("wine sauce", "beer-battered"), because
 *     the alcohol is no longer the item and most of it has boiled off;
 *   - an item whose CoFID row is missing, which fails silently and leaves the
 *     model's estimate, because a missing reference is not a reason to guess
 *     differently.
 */
export async function correctDrinkEstimates<T extends Item>(
  supabase: SupabaseClient,
  items: T[]
): Promise<{ items: T[]; corrections: DrinkCorrection[] }> {
  const corrections: DrinkCorrection[] = [];
  const wanted = new Map<number, { ref: DrinkRef; ml: number; note: string | null }>();

  items.forEach((item, i) => {
    const text = `${item.name ?? ''} ${item.quantity ?? ''}`.trim();
    if (!text) return;
    // COOKED WITH, NOT DRUNK. "Beer-battered cod" and "red wine sauce" are food.
    if (/\b(sauce|batter|battered|braised|marinade|marinated|reduction|gravy|poached in|cooked in)\b/i.test(text)) return;

    const ref = DRINKS.find((d) => d.match.test(text));
    if (!ref) return;
    const { ml, note } = statedMl(text, ref.defaultMl);
    wanted.set(i, { ref, ml, note });
  });

  if (wanted.size === 0) return { items, corrections };

  const names = [...new Set([...wanted.values()].map((w) => w.ref.cofid))];
  const { data, error } = await supabase
    .from('food_composition')
    .select('name, kcal, protein_g')
    .in('name', names);

  if (error || !data) {
    console.log('DRINK COMPOSITION LOOKUP FAILED:', error?.message);
    return { items, corrections };
  }

  const byName = new Map(data.map((r) => [r.name as string, r]));
  const out = items.map((item, i) => {
    const w = wanted.get(i);
    if (!w) return item;
    const row = byName.get(w.ref.cofid);
    if (!row || row.kcal == null || row.protein_g == null) return item;

    const kcal = Math.round((Number(row.kcal) * w.ml) / 100);
    const protein = Math.round((Number(row.protein_g) * w.ml) / 100 * 10) / 10;

    // NOTHING CHANGES WHEN THE ESTIMATE WAS ALREADY RIGHT. A correction that
    // rewrites 68 as 68 is noise in the log and makes the real ones harder to see.
    const kcalWasClose = item.kcal != null && Math.abs(item.kcal - kcal) <= Math.max(10, kcal * 0.15);
    const proteinWasClose =
      item.protein_g != null && Math.abs(item.protein_g - protein) <= Math.max(0.5, protein * 0.25);
    if (kcalWasClose && proteinWasClose) return item;

    corrections.push({
      name: item.name ?? w.ref.cofid,
      from: { kcal: item.kcal ?? null, protein_g: item.protein_g ?? null },
      to: { kcal, protein_g: protein },
      source: w.ref.cofid,
      measure: w.note ?? w.ref.measureNote,
    });

    return { ...item, kcal, protein_g: protein };
  });

  return { items: out, corrections };
}
