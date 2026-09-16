// Pure helpers for the Food segment's today's-log view (SELODIA_SPEC.md, The
// Food Segment). Kept out of the component so the arithmetic is node-testable —
// the same split as overview-metrics.ts and protein-quality.ts.

export type FoodLogSummary = {
  id: string;
  happened_at: string;
  meal_label: string | null;
  raw_text: string | null;
  kcal: number | null;
  protein_g: number | null;
};

export type DayTotals = { kcal: number; protein: number };

// A day's running totals. Nulls count as zero rather than disqualifying the
// row — a log with a description but no parsed macros still happened, and the
// Accuracy Philosophy prefers a logged approximation to an omission.
export function sumDay(rows: Pick<FoodLogSummary, 'kcal' | 'protein_g'>[]): DayTotals {
  return rows.reduce<DayTotals>(
    (acc, r) => ({ kcal: acc.kcal + (r.kcal ?? 0), protein: acc.protein + (r.protein_g ?? 0) }),
    { kcal: 0, protein: 0 }
  );
}

// The one-line weekly average (e.g. "Avg 1,590 kcal · 91g protein"). Averaged
// over DAYS THAT WERE LOGGED, never over a fixed 7 — an unlogged day is missing
// data, not a zero-calorie day, and dividing by 7 would quietly invent a
// downward trend. This mirrors Part Nine's rule for weekly calculations:
// excluded from the number, not estimated as zero.
export function weeklyAverage(
  rows: Pick<FoodLogSummary, 'happened_at' | 'kcal' | 'protein_g'>[],
  toDayKey: (iso: string) => string
): { kcal: number; protein: number; daysLogged: number } | null {
  const byDay = new Map<string, DayTotals>();
  for (const r of rows) {
    const key = toDayKey(r.happened_at);
    const cur = byDay.get(key) ?? { kcal: 0, protein: 0 };
    byDay.set(key, {
      kcal: cur.kcal + (r.kcal ?? 0),
      protein: cur.protein + (r.protein_g ?? 0),
    });
  }
  const days = [...byDay.values()];
  if (days.length === 0) return null;
  const total = days.reduce(
    (a, d) => ({ kcal: a.kcal + d.kcal, protein: a.protein + d.protein }),
    { kcal: 0, protein: 0 }
  );
  return {
    kcal: Math.round(total.kcal / days.length),
    protein: Math.round(total.protein / days.length),
    daysLogged: days.length,
  };
}

// A row's display label: WHAT WAS EATEN, not what the parse decided to call it.
//
// FLIPPED 2026-09-16, after a week of catch-up logs came back labelled Dinner,
// Dinner, Dinner. Ruth: "All the items in the food log are randomly assigned
// categories which are not accurate or useful, meaning it's hard to see at a
// glance what you've eaten, better to have the actual food listed too."
//
// meal_label is inferred - the model guesses a category from time-of-day clues
// that a typed catch-up does not contain. raw_text is her own words for that
// entry, and it is the one part of a log that cannot be wrong. So the words
// lead and the category survives only as a fallback for rows that have none: a
// photo log, or an entry from before raw_text was kept.
export function entryLabel(row: Pick<FoodLogSummary, 'meal_label' | 'raw_text'>): string {
  const raw = row.raw_text?.trim();
  if (raw) return raw.length > 60 ? `${raw.slice(0, 57)}…` : raw;
  const label = row.meal_label?.trim();
  if (label) return label;
  return 'Entry';
}
