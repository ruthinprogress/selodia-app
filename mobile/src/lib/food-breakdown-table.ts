// The itemised food table shown in chat when something is logged.
//
// WHY A COMPONENT AND NOT MARKDOWN. The format was specified as a markdown
// table, and the chat had no markdown renderer at all - a plain RN <Text> would
// have shown the pipe characters literally. Adding a parser was the obvious
// fix and the wrong one: it would mean the model writes the numbers as prose
// and the app reads them back, so the table could quietly disagree with what
// was actually stored. `food_items` (item 11) already holds exactly these rows.
// So the chat turn carries the food_log_id and this builds the table from the
// stored data - the table is a VIEW of the log, never a retelling of it.
//
// Pure and node-tested; the component is the thin renderer over it.

export type BreakdownItem = {
  id: string;
  name: string;
  quantity: string | null;
  kcal: number | null;
  protein_g: number | null;
  protein_source: string | null;
  amino_profile: string | null;
};

export type BreakdownRow = {
  key: string;
  label: string;
  kcal: string;
  protein: string;
  isTotal: boolean;
};

// SEVERAL MEALS AT ONCE GET A SUMMARY, NOT SILENCE (2026-10-04).
//
// Ruth, after voice-logging a whole Saturday: "no summary table came through in
// the chat to show what was logged."
//
// The itemised table above is built for ONE meal, and the turn that logs several
// used to set its food_log_id to null - "a catch-up of seven days has seven rows
// and no single table to show, and picking one of them would show that day's
// breakdown under a reply about the week." That reasoning is right and the
// conclusion was wrong: showing NOTHING leaves her with a sentence claiming a
// save and no way to check it, which is the one thing this project keeps
// learning not to do.
//
// A MEAL PER ROW, NOT AN ITEM PER ROW. Itemising four meals in a chat bubble
// would be thirty lines. The summary answers the question she actually has -
// "did it get all of it, and roughly what was that?" - and tapping any entry
// still opens its full breakdown.
export type DayLog = {
  id: string;
  meal_label: string | null;
  raw_text: string | null;
  happened_at: string | null;
  kcal: number | null;
  protein_g: number | null;
};

/** One row per meal, then a total. Pure; node-tested. */
export function buildDaySummaryRows(logs: DayLog[]): BreakdownRow[] {
  const ordered = [...logs].sort(
    (a, b) => Date.parse(a.happened_at ?? '') - Date.parse(b.happened_at ?? '')
  );
  const rows: BreakdownRow[] = ordered.map((log) => ({
    key: log.id,
    label: mealSummaryLabel(log),
    kcal: kcalCell(log.kcal),
    protein: proteinCell(log.protein_g, true),
    isTotal: false,
  }));
  // THE TOTAL IS THE SUM OF WHAT IS SHOWN. A meal with no figure contributes
  // nothing rather than zero, and the total is marked approximate because every
  // part of it is.
  const kcal = ordered.reduce((n, l) => n + (l.kcal ?? 0), 0);
  const protein = ordered.reduce((n, l) => n + (l.protein_g ?? 0), 0);
  rows.push({
    key: 'total',
    label: ordered.length === 1 ? 'Total' : `Total, ${ordered.length} meals`,
    kcal: kcalCell(kcal),
    protein: proteinCell(protein, true),
    isTotal: true,
  });
  return rows;
}

/**
 * What a meal is called in the summary: its own words where there are any, the
 * category otherwise. Same flip as breakdownHeading, for the same reason - the
 * category is inferred and the words are hers.
 */
export function mealSummaryLabel(log: DayLog): string {
  const meal = log.meal_label?.trim();
  const raw = log.raw_text?.trim();
  if (!raw) return meal || 'Logged';
  // The parse writes "Dinner - fish and chips"; the label column already carries
  // "Dinner", so the repeat is dropped rather than printed twice.
  let text = raw;
  if (meal) {
    const lead = new RegExp('^\\s*(?:yesterday\\s*[:,-]\\s*)?' + meal + '\\s*[-:\\u2013\\u2014]\\s*', 'i');
    text = text.replace(lead, '');
  }
  text = text.replace(/^\s*yesterday\s*[:,-]\s*/i, '').trim();
  const named = text.length > 44 ? `${text.slice(0, 41)}\u2026` : text;
  return meal ? `${meal} \u00b7 ${named}` : named;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "Saturday 16 May · pizza and chips", or just the date when there is nothing
// to name. The date comes from the log's own happened_at, not from today: a meal
// logged late ("that was yesterday's lunch") must head the day it happened.
//
// THE FOOD NAMES THE ENTRY, NOT THE CATEGORY (2026-09-16). This read "Monday 7
// September · Dinner" in the thread, and Ruth's answer was that it could not be
// discussed: "what could be discussed about 'dinner' - it's not specific enough
// to add any value". The same flip as entryLabel, for the same reason - the
// category is inferred, the words are hers. mealLabel is kept as the fallback so
// a photo log still heads with something true.
export function breakdownHeading(
  happenedAt: string | null,
  mealLabel: string | null,
  rawText?: string | null
): string {
  const parts: string[] = [];
  if (happenedAt) {
    const d = new Date(happenedAt);
    if (!isNaN(d.getTime())) {
      parts.push(`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
    }
  }
  const raw = rawText?.trim();
  const named = raw ? (raw.length > 60 ? `${raw.slice(0, 57)}…` : raw) : mealLabel?.trim();
  if (named) parts.push(named);
  return parts.join(' · ');
}

// Cell formatting follows Ruth's own logging format exactly (2026-08-27):
// kcal carries a "~" because every one of them is an estimate; per-item protein
// is written plainly; the TOTAL protein carries a "~" as the sum of estimates.
// Zero is bare - "0", not "~0" or "0g" - because nothing about it is estimated.
function kcalCell(n: number | null): string {
  if (n == null) return '—';
  const r = Math.round(n);
  return r === 0 ? '0' : `~${r}`;
}

function proteinCell(n: number | null, approximate: boolean): string {
  if (n == null) return '—';
  const r = Math.round(n);
  if (r === 0) return '0';
  return approximate ? `~${r}g` : `${r}g`;
}

// An item's label. The quantity rides WITH the name ("Cheese 20g", "Scrambled
// eggs x2") rather than in its own column, matching the source format - the
// parse step writes both, and a separate column would strand rows that have no
// quantity with an empty cell.
export function itemLabel(item: BreakdownItem): string {
  const name = item.name.trim();
  const qty = item.quantity?.trim();
  if (!qty) return name;
  // Don't repeat a quantity the model already folded into the name.
  if (name.toLowerCase().includes(qty.toLowerCase())) return name;
  // A bare count reads as part of the name otherwise - "Felix Pizza Crisps 3"
  // looks like a product variant. The multiplier form is what the source format
  // uses ("Scrambled eggs x2").
  return /^\d+(\.\d+)?$/.test(qty) ? `${name} x${qty}` : `${name} ${qty}`;
}

// One row per item, then the bolded total.
//
// The total is SUMMED FROM THE ROWS rather than taken from food_logs' own
// kcal/protein_g columns. Those are the parse step's figure for the whole meal
// and can differ from the sum of its parts by a rounding step or two; a table
// whose total does not equal its own visible column is the one thing a reader
// will spot instantly, and it would undermine the exact literacy this is for.
export function buildBreakdownRows(items: BreakdownItem[]): BreakdownRow[] {
  const rows: BreakdownRow[] = items.map((it) => ({
    key: it.id,
    label: itemLabel(it),
    kcal: kcalCell(it.kcal),
    protein: proteinCell(it.protein_g, false),
    isTotal: false,
  }));

  const anyKcal = items.some((i) => i.kcal != null);
  const anyProtein = items.some((i) => i.protein_g != null);
  const sum = (pick: (i: BreakdownItem) => number | null) =>
    items.reduce((s, i) => s + (pick(i) ?? 0), 0);

  rows.push({
    key: '__total__',
    label: 'Total',
    kcal: anyKcal ? kcalCell(sum((i) => i.kcal)) : '—',
    protein: anyProtein ? proteinCell(sum((i) => i.protein_g), true) : '—',
    isTotal: true,
  });

  return rows;
}

