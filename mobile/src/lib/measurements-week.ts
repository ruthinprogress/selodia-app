import { findWeekAgoReading, type MeasurementRow } from '@/lib/overview-metrics';
import { toLocalDateKey } from '@/lib/week';

// The Measurements weekly table (build item 38, slice 1).
//
// One row per day: Day / Weight / Body fat / Muscle, each carrying a trailing
// 7d percentage delta (Part Five, The Measurements Segment).
//
// PERCENT here, not the absolute delta the Overview shows. Both are deliberate:
// the Overview's glance says "↘ -0.4 vs last wk" because an absolute kilogram is
// what you feel, while this table says "-0.5% 7d" because it sits beside body
// fat and muscle, where a percentage is the only way three metrics on different
// scales can be read down a column together. So overview-metrics.ts keeps its
// absolute form untouched and this adds the percentage one.

export type DayRow = {
  dayKey: string;
  date: Date;
  // null when nothing was logged that day - most days, for most people.
  reading: MeasurementRow | null;
  weightPct: number | null;
  bodyFatPct: number | null;
  musclePct: number | null;
};

// A signed percentage change, rounded to one place. Null when either side is
// missing, so the caller shows nothing rather than a fabricated 0%.
export function percentDelta(latest: number | null, weekAgo: number | null): number | null {
  if (latest == null || weekAgo == null || weekAgo === 0) return null;
  return Math.round(((latest - weekAgo) / weekAgo) * 1000) / 10;
}

// "−0.5% 7d". Uses a real minus sign rather than a hyphen so a negative reads
// as a number rather than as a dash before a digit.
export function formatPercentDelta(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct === 0) return '0% 7d';
  const sign = pct > 0 ? '+' : '−';
  return `${sign}${Math.abs(pct)}% 7d`;
}

// The latest reading on each given day, with its deltas against whatever was
// logged roughly a week before THAT reading.
//
// allRows must span beyond the displayed week: the 7d comparison reaches back
// outside it by definition, so passing only the week's own rows would silently
// produce a table with no deltas at all.
//
// A reference reading only counts if it actually sits about a week back. This
// is the tolerance findWeekAgoReading deliberately does NOT apply: it returns
// the nearest earlier reading at any distance, which is right for the
// Overview's soft "vs last wk" glance but wrong for a column headed "7d". With
// sparse data - which is the normal case here - the nearest earlier reading can
// be three months old, and labelling that "-0.5% 7d" would state something
// untrue. Outside the window the cell shows no delta instead.
export const REFERENCE_WINDOW_DAYS = { min: 4, max: 11 };

function referenceFor(rows: MeasurementRow[], measuredAt: string): MeasurementRow | null {
  const ref = findWeekAgoReading(rows, measuredAt);
  if (!ref) return null;
  const gapDays = (new Date(measuredAt).getTime() - new Date(ref.measured_at).getTime()) / 86_400_000;
  if (gapDays < REFERENCE_WINDOW_DAYS.min || gapDays > REFERENCE_WINDOW_DAYS.max) return null;
  return ref;
}

export function buildWeekRows(days: Date[], allRows: MeasurementRow[]): DayRow[] {
  const byDay = new Map<string, MeasurementRow>();
  for (const r of allRows) {
    const t = new Date(r.measured_at);
    if (isNaN(t.getTime())) continue;
    const key = toLocalDateKey(t);
    const existing = byDay.get(key);
    // More than one reading in a day is normal (a re-weigh). The latest wins,
    // matching "current = latest" everywhere else.
    if (!existing || new Date(r.measured_at).getTime() > new Date(existing.measured_at).getTime()) {
      byDay.set(key, r);
    }
  }

  return days.map((date) => {
    const dayKey = toLocalDateKey(date);
    const reading = byDay.get(dayKey) ?? null;
    if (!reading) {
      return { dayKey, date, reading: null, weightPct: null, bodyFatPct: null, musclePct: null };
    }
    const ref = referenceFor(allRows, reading.measured_at);
    return {
      dayKey,
      date,
      reading,
      weightPct: percentDelta(reading.weight_kg, ref?.weight_kg ?? null),
      bodyFatPct: percentDelta(reading.body_fat_pct, ref?.body_fat_pct ?? null),
      musclePct: percentDelta(reading.muscle_kg, ref?.muscle_kg ?? null),
    };
  });
}

// One decimal, or an em dash when there is nothing. An em dash reads as "not
// recorded"; a 0 would read as a measurement of zero.
export function formatMetric(v: number | null): string {
  return v == null ? '—' : String(Math.round(v * 10) / 10);
}

export function hasAnyReading(rows: DayRow[]): boolean {
  return rows.some((r) => r.reading !== null);
}
