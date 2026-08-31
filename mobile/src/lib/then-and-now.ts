// "Then & Now" (Part Five, The Measurements Segment — build item 16, slice 3).
//
// A PLAIN TABLE, NOT A CHART, and the spec gives the reason rather than a
// preference: "a simple numeric chart can undersell what has actually changed
// for a user (relationship with food, confidence) and a table grounds any delta
// in the real numbers it came from rather than presenting an abstract figure."
// So every row shows its two real readings alongside the percentage — the figure
// never appears on its own, because on its own it is the abstraction the spec
// rejected.
//
// WEIGHT AND MUSCLE TOGETHER, deliberately: "the recomposition story the two
// rows tell together, which either number alone would hide." Weight down 5.2%
// reads as loss; muscle up 2.9% beside it reads as recomposition. Rendering
// either row without the other would tell half a story, so the builder returns
// them as one set and the component renders what it is given.
//
// DELIBERATELY MODEST NAMING, per the spec, "since it only claims to show two
// points in time". Nothing here computes a trend, a rate, or a projection: two
// readings are two readings. The trajectory rules live in roundup-rules.ts and
// need three, which is exactly the line this must not quietly cross.
//
// Body fat is NOT a row. Part Five names weight and muscle, and adding a third
// because the column exists would be the app deciding a person's body-fat
// percentage belongs in their headline progress story — an editorial judgement
// the segment's own ordering rule refuses to make elsewhere.

export type Reading = {
  measuredAt: string;
  weightKg: number | null;
  muscleKg: number | null;
};

export type ThenAndNowRow = {
  label: string;
  unit: string;
  thenValue: number;
  thenDate: string;
  nowValue: number;
  nowDate: string;
  // Percentage difference, one decimal. Signed, because direction is the whole
  // point of putting the two rows next to each other.
  percentChange: number;
};

export type ThenAndNow = {
  rows: ThenAndNowRow[];
  // Why there is nothing to show, when there is nothing to show. An empty table
  // with no explanation reads as broken; this lets the component say which of
  // the two honest reasons applies.
  emptyReason: 'no_readings' | 'single_reading' | null;
};

function pct(then: number, now: number): number {
  if (then === 0) return 0;
  return Math.round(((now - then) / then) * 1000) / 10;
}

// Earliest and latest reading that actually carry the metric.
//
// PER METRIC, not per row. Someone's first weigh-in may predate their first
// muscle reading by months — a scale that only reports weight, then a
// bioimpedance one later. Taking "the first row" and reading both columns off it
// would silently compare a muscle figure against nothing, or worse, against a
// null that arithmetic turns into zero.
function bounds(
  readings: Reading[],
  pick: (r: Reading) => number | null
): { first: { value: number; date: string }; last: { value: number; date: string } } | null {
  const withValue = readings
    .map((r) => ({ value: pick(r), date: r.measuredAt }))
    .filter((r): r is { value: number; date: string } => r.value != null && Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  // One reading is a position, not a change — the same line weekDelta draws in
  // the weekly roundup. A single weigh-in would otherwise render as 0.0%, which
  // reads as "nothing has changed" when the truth is "there is nothing to
  // compare against yet".
  if (withValue.length < 2) return null;
  return { first: withValue[0], last: withValue[withValue.length - 1] };
}

export function buildThenAndNow(readings: Reading[]): ThenAndNow {
  if (readings.length === 0) return { rows: [], emptyReason: 'no_readings' };

  const rows: ThenAndNowRow[] = [];

  const weight = bounds(readings, (r) => r.weightKg);
  if (weight) {
    rows.push({
      label: 'Weight',
      unit: 'kg',
      thenValue: weight.first.value,
      thenDate: weight.first.date,
      nowValue: weight.last.value,
      nowDate: weight.last.date,
      percentChange: pct(weight.first.value, weight.last.value),
    });
  }

  // Muscle in kg throughout, matching body_measurements.muscle_kg (Part Five).
  const muscle = bounds(readings, (r) => r.muscleKg);
  if (muscle) {
    rows.push({
      label: 'Muscle',
      unit: 'kg',
      thenValue: muscle.first.value,
      thenDate: muscle.first.date,
      nowValue: muscle.last.value,
      nowDate: muscle.last.date,
      percentChange: pct(muscle.first.value, muscle.last.value),
    });
  }

  return {
    rows,
    emptyReason: rows.length === 0 ? 'single_reading' : null,
  };
}

// Signed and rounded for display. Zero renders without a sign: "+0.0%" implies a
// measured gain that did not happen, and "−0.0%" is worse.
export function formatPercent(p: number): string {
  if (p === 0) return '0%';
  return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`;
}
