import { MACROS, type MacroKey } from '@/lib/tracked-macros';

// WHERE YOURS CAME FROM, AND WHAT YOU ARE NOT EATING.
//
// Ruth, 24 October 2026: "the Where Yours Came From section is missing, please
// build it now, see artwork for reference and the notes we discussed in details
// yesterday about how to do the groupings....and then you never used..."
//
// THE NOTES SHE MEANS, recovered from the transcript rather than from memory,
// and agreed by her on 23 October with "Yes, good":
//
//   1. DEFAULT: LIST THE FOODS. Straight from her own log. No food-to-category
//      table to build and maintain, no edge cases, and - the reason it beats a
//      taxonomy outright - no vegan problem at all.
//   2. GROUP ONLY WHERE THE GROUP SAYS SOMETHING THE FOOD NAMES DO NOT. That is
//      protein, and only protein, where the app ALREADY stores protein_source
//      at parse time. ChatGPT's artwork grouped everything, and the tell was
//      "Grains & other" holding 15%: when a taxonomy needs an "other" bucket
//      that big, it is not earning its place.
//   3. HIDE ZERO ROWS. "A vegan seeing Meat, poultry & fish · 0g" was the
//      example. It is also just noise for everybody else.
//   4. SUGGEST FOODS SHE IS NOT ALREADY EATING, drawn from a real composition
//      table, never invented - and say what they CARRY, never what to do.
//
// THE DIETARY-CONSTRAINT ANSWER IS THE SAME ONE, which is why this file has no
// concept of vegan, vegetarian or flexitarian in it. Her log says what she
// actually eats. A flexitarian is precisely the person a flag would fail and a
// log succeeds: somebody who eats meat twice a month is neither one thing nor
// the other, and their record needs no label to be true.

export type ItemRow = {
  name: string | null;
  protein_source?: string | null;
  [column: string]: unknown;
};

export type SourceRow = {
  /** The food, in her own words from the log. */
  label: string;
  /** How much of this nutrient it carried, over the period. */
  amount: number;
  /** Its share of the total, 0-1. */
  share: number;
};

/** Grams of this nutrient in one row, in the unit the screen shows. */
function amountOf(row: ItemRow, key: MacroKey): number {
  const spec = MACROS.find((m) => m.key === key);
  if (!spec) return 0;
  const raw = row[spec.column];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Salt is stored as sodium in milligrams and shown as grams of salt. The same
  // conversion macroAmount does, for the same reason: a breakdown in a
  // different unit from the figure above it is a breakdown of something else.
  return key === 'salt' ? n / 400 : n;
}

/** How she wrote it, tidied only enough that one food is one row. */
function tidy(name: string | null): string | null {
  const t = (name ?? '').trim().replace(/\s+/g, ' ');
  if (t.length < 2) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * The foods that carried this nutrient, biggest first.
 *
 * ZERO ROWS NEVER APPEAR. A food that carried none of it is not a small
 * contributor, it is not a contributor, and listing it teaches somebody to
 * scroll past the list.
 *
 * `limit` folds the tail into one row rather than truncating it, because a
 * breakdown whose parts do not sum to the whole is a breakdown somebody will
 * try to reconcile and fail.
 */
export function whereItCameFrom(items: ItemRow[], key: MacroKey, limit = 6): SourceRow[] {
  const byFood = new Map<string, number>();
  let total = 0;

  for (const row of items) {
    const label = tidy(row.name);
    const amount = amountOf(row, key);
    if (!label || amount <= 0) continue;
    byFood.set(label, (byFood.get(label) ?? 0) + amount);
    total += amount;
  }
  if (total <= 0) return [];

  const sorted = [...byFood.entries()]
    .map(([label, amount]) => ({ label, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount);

  if (sorted.length <= limit) return sorted;

  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  const restAmount = rest.reduce((n, r) => n + r.amount, 0);
  return [
    ...head,
    { label: `Other (${rest.length})`, amount: restAmount, share: restAmount / total },
  ];
}

/**
 * THE ONE PLACE A GROUP EARNS ITS KEEP: where protein came from.
 *
 * It groups on `protein_source`, which the parser records at log time, so there
 * is no food-to-category table in this repository and never needs to be. And
 * the distinction it draws is the one that matters most to somebody eating
 * mostly plants, which is the opposite of the artwork's version where "Plant
 * sources" was a single undifferentiated row.
 *
 * THE LABELS ARE PLACEHOLDERS AND ARE MARKED AS SUCH. Ruth rejected
 * "Animal/Plant/Non-Essential" on 23 October - "no thats not right" - and the
 * words have not been settled since. These are the stored values said plainly;
 * they are not a judgement about any food, and nothing here calls a food
 * incomplete, because that is a verdict on a food and her own rule forbids it.
 */
export const PROTEIN_SOURCE_LABEL: Record<string, string> = {
  animal: 'Animal sources',
  plant: 'Plant sources',
  collagen: 'Collagen',
};

export function proteinBySource(items: ItemRow[]): SourceRow[] {
  const byGroup = new Map<string, number>();
  let total = 0;

  for (const row of items) {
    const amount = amountOf(row, 'protein');
    if (amount <= 0) continue;
    const src = typeof row.protein_source === 'string' ? row.protein_source : null;
    // UNCLASSIFIED PROTEIN IS ITS OWN ROW, never quietly folded into a group it
    // was not put in. The totals have to add up to what the figure above says.
    const label = (src && PROTEIN_SOURCE_LABEL[src]) || 'Not classified';
    byGroup.set(label, (byGroup.get(label) ?? 0) + amount);
    total += amount;
  }
  if (total <= 0) return [];

  return [...byGroup.entries()]
    .map(([label, amount]) => ({ label, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount);
}

// ── SUGGESTIONS ─────────────────────────────────────────────────────────────

export type CandidateFood = {
  name: string;
  /** Per 100g, from the composition table. */
  per100g: number;
};

export type Suggestion = {
  food: string;
  /** The arithmetic, in her own rule's form. */
  carries: string;
};

/** Does a candidate name already appear among the foods she logged? */
function alreadyEating(name: string, eaten: string[]): boolean {
  const n = name.toLowerCase();
  return eaten.some((e) => {
    const t = e.toLowerCase();
    return t.includes(n) || n.includes(t);
  });
}

/**
 * Good sources she is NOT already eating.
 *
 * Ruth, 24 October: "it should have any good quality sources that they are not
 * currently eating and how to have them."
 *
 * SAY WHAT IT CARRIES, NEVER WHAT TO DO. Her rule from 21 October, written into
 * the spec: "A handful of berries carries about 2g of fibre" rather than "try
 * adding berries". The arithmetic form is more precise AND does not instruct,
 * which is why it is a rule and not a compromise.
 *
 * NOTHING IS INVENTED. Every figure comes from the CoFID composition table the
 * app already carries; this function only filters and phrases it.
 */
export function suggestionsFor(
  candidates: CandidateFood[],
  eaten: string[],
  key: MacroKey,
  limit = 3
): Suggestion[] {
  const spec = MACROS.find((m) => m.key === key);
  if (!spec) return [];
  const unit = spec.unit === 'mg' ? 'mg' : 'g';

  const out: Suggestion[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    if (out.length >= limit) break;
    if (!(c.per100g > 0)) continue;
    const food = tidy(c.name);
    if (!food || seen.has(food)) continue;
    if (alreadyEating(food, eaten)) continue;
    seen.add(food);
    const figure = unit === 'mg' ? Math.round(c.per100g) : Math.round(c.per100g * 10) / 10;
    out.push({
      food,
      carries: `100 g carries about ${figure} ${unit}`,
    });
  }
  return out;
}
