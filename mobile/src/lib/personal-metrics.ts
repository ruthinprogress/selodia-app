// The second Measurements table: everything someone tracks that a scale does
// not read - waist, thigh, blood pressure, resting heart rate, anything.
//
// WHY IT IS TRANSPOSED (one row per METRIC, not per day). The scale table above
// it is day-rows x fixed-metric-columns, which works because a bioimpedance
// scale emits all three numbers at once on a regular cadence. These metrics have
// neither property: waist might be monthly, resting heart rate daily, blood
// pressure occasionally, each logged independently. A week grid with a column
// per metric would be mostly empty and get emptier with every metric added -
// which is exactly the permanent-empty-cells problem the two-table split exists
// to solve, rebuilt one level down. A metric appears here only once it has data,
// so there are never empty cells, and it grows downward, which is the direction
// a phone scrolls.

export type PersonalMetricRow = {
  id: string;
  metric_name: string;
  value: number;
  value_secondary: number | null;
  unit: string | null;
  measured_at: string;
  created_at: string;
};

export type MetricSummary = {
  name: string;
  latest: PersonalMetricRow;
  // The reading before the latest one, when there is one. Null on a first-ever
  // entry, which is most metrics for a while.
  previous: PersonalMetricRow | null;
  // Used only for ordering; never shown.
  firstLoggedAt: number;
};

// Grouped by metric, ordered by when each metric was FIRST logged.
//
// Chronological by first-logged is Ruth's decision (2026-08-27) and the reason
// matters: any other order - by recency, by how much something moved, by a
// notion of importance - would be the app making an editorial judgement about
// which of someone's metrics deserves the top row. First-logged is the one rule
// that is both predictable and free of that judgement, and it keeps the table
// stable: a metric never jumps position because of what a reading did.
export function summariseMetrics(rows: PersonalMetricRow[]): MetricSummary[] {
  const byName = new Map<string, PersonalMetricRow[]>();
  for (const r of rows) {
    const list = byName.get(r.metric_name) ?? [];
    list.push(r);
    byName.set(r.metric_name, list);
  }

  const summaries: MetricSummary[] = [];
  for (const [name, list] of byName) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
    );
    const latest = sorted[0];
    if (!latest) continue;
    summaries.push({
      name,
      latest,
      previous: sorted[1] ?? null,
      firstLoggedAt: Math.min(...list.map((r) => new Date(r.created_at).getTime())),
    });
  }

  return summaries.sort((a, b) => a.firstLoggedAt - b.firstLoggedAt);
}

const trim = (n: number): string => String(Math.round(n * 10) / 10);

// "70 cm", "120/80 mmHg", "58 bpm", or a bare number when no unit was captured.
// The unit is whatever the person said - there is no canonical unit to convert
// to across an unbounded metric space, so it is carried rather than guessed.
export function formatValue(row: PersonalMetricRow): string {
  const core =
    row.value_secondary != null ? `${trim(row.value)}/${trim(row.value_secondary)}` : trim(row.value);
  return row.unit ? `${core} ${row.unit}` : core;
}

// The change against the PREVIOUS reading of the same metric, in that metric's
// own unit - never a percentage.
//
// The scale table uses "% 7d" because three metrics on different scales sit in
// adjacent columns and only a percentage reads down them together. Here every
// row is its own metric with its own unit, so an absolute change is both more
// honest and more useful: "−1.5 cm" is a thing you can picture, "−2.1%" is not.
//
// A paired reading (blood pressure) gets no delta: which of two numbers moved is
// the whole question, and one arrow cannot answer it without picking a side.
export function formatChange(summary: MetricSummary): string | null {
  const { latest, previous } = summary;
  if (!previous) return null;
  if (latest.value_secondary != null || previous.value_secondary != null) return null;
  const delta = latest.value - previous.value;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return 'no change';
  // A real minus sign, so a negative reads as a number rather than as a dash
  // before a digit - the same choice the scale table makes.
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded)}${latest.unit ? ` ${latest.unit}` : ''}`;
}

const DAY_MS = 86_400_000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// How long ago, in the words someone would use. Falls back to a date once
// "N days ago" stops being something anyone can picture.
export function formatWhen(measuredAt: string, now: Date = new Date()): string {
  const then = new Date(measuredAt);
  if (isNaN(then.getTime())) return '';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 28) return `${Math.floor(days / 7)} weeks ago`;
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}
