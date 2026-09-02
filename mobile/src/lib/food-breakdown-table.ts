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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "Saturday 16 May — Breakfast", or just the date when the meal is unlabelled.
// The date comes from the log's own happened_at, not from today: a meal logged
// late ("that was yesterday's lunch") must head the day it happened.
export function breakdownHeading(happenedAt: string | null, mealLabel: string | null): string {
  const parts: string[] = [];
  if (happenedAt) {
    const d = new Date(happenedAt);
    if (!isNaN(d.getTime())) {
      parts.push(`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
    }
  }
  const label = mealLabel?.trim();
  if (label) parts.push(label);
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

