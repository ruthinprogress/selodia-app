import type { MeasurementRow } from '@/lib/overview-metrics';
import { toLocalDateKey } from '@/lib/week';

// A DAY'S MEASUREMENTS, WHATEVER TOOK THEM (2026-09-25, for the Measurements
// redesign).
//
// WHY THE TWO SOURCES MERGE NOW, when the existing screen deliberately keeps
// them apart. That decision is on the record and its reasoning was sound:
//
//   "Split by SOURCE: someone can stop using a scale and keep measuring
//    everything else, or the reverse, and one combined table would leave
//    permanent empty cells for whichever they stopped."  (Ruth, 2026-08-27)
//
// The words that matter are "combined TABLE". A table has a fixed set of
// columns, so a metric nobody records any more leaves a blank in every row
// forever. A CARD has no columns: it lists the metrics that have a value and
// stops. Somebody who gives up the scale and keeps the tape measure gets a card
// with waist and thighs on it, not a card with three dashes and two numbers.
//
// So the old reasoning is not overturned, it is satisfied by a different shape.
// If the redesign ever goes back to a grid, the split has to come back with it.
//
// NOTHING IS INVENTED OR CARRIED FORWARD. A day holds what was recorded that
// day. Yesterday's weight is not repeated onto today with a note - that would
// be the app stating a measurement nobody took.

export type MetricValue = {
  /** Stable key for React and for ordering. */
  key: string;
  label: string;
  /** Already formatted for display, units and all. */
  text: string;
  /** The raw number, for deltas. */
  value: number;
};

export type MeasurementDay = {
  dayKey: string;
  date: Date;
  /** When the latest of the day's entries was recorded. Null if unknown. */
  loggedAt: Date | null;
  metrics: MetricValue[];
};

/** One personal metric row, as the table stores it. */
export type PersonalMetricRow = {
  metric_name: string;
  value: number | null;
  unit: string | null;
  measured_at: string | null;
  created_at: string;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Sentence case for a stored metric name.
 *
 * These are typed by whoever logged them, through the conversation, so they
 * arrive as "waist", "Waist" or occasionally "left thigh". Capitalising the
 * first letter is the whole treatment: rewriting somebody's own word for a part
 * of their own body is not this function's business.
 */
function labelFor(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** The scale's three, in the order they are always read. */
function scaleMetrics(r: MeasurementRow): MetricValue[] {
  const out: MetricValue[] = [];
  if (r.weight_kg != null) {
    out.push({ key: 'weight', label: 'Weight', text: `${round1(r.weight_kg)} kg`, value: r.weight_kg });
  }
  if (r.body_fat_pct != null) {
    // The percent sits on its number, as it does everywhere else in the app.
    out.push({ key: 'body_fat', label: 'Body fat', text: `${round1(r.body_fat_pct)}%`, value: r.body_fat_pct });
  }
  if (r.muscle_kg != null) {
    out.push({ key: 'muscle', label: 'Muscle', text: `${round1(r.muscle_kg)} kg`, value: r.muscle_kg });
  }
  return out;
}

/**
 * Every day in `days` that has anything recorded on it, newest first.
 *
 * A day with nothing is LEFT OUT, not included empty. The old weekly table drew
 * all seven rows because a table has to; a list of cards does not, and seven
 * cards saying "—" is a week of nothing presented as a week of something.
 */
export function buildMeasurementDays(
  days: Date[],
  readings: MeasurementRow[],
  personal: PersonalMetricRow[]
): MeasurementDay[] {
  const out: MeasurementDay[] = [];

  for (const date of days) {
    const dayKey = toLocalDateKey(date);

    // The day's latest scale reading. Sorted rather than assumed: the query
    // orders newest-first today, and a list that quietly depends on a caller's
    // ORDER BY is a bug waiting for somebody to change the query.
    const dayReadings = readings
      .filter((r) => toLocalDateKey(new Date(r.measured_at)) === dayKey)
      .sort((a, b) => b.measured_at.localeCompare(a.measured_at));
    const latest = dayReadings[0] ?? null;

    // Every personal metric recorded that day, latest value per name.
    const seen = new Map<string, PersonalMetricRow>();
    for (const p of personal) {
      const when = p.measured_at ?? p.created_at;
      if (toLocalDateKey(new Date(when)) !== dayKey) continue;
      const key = p.metric_name.trim().toLowerCase();
      const held = seen.get(key);
      const heldWhen = held ? (held.measured_at ?? held.created_at) : null;
      if (!held || (heldWhen != null && when > heldWhen)) seen.set(key, p);
    }

    const metrics: MetricValue[] = latest ? scaleMetrics(latest) : [];
    for (const [key, p] of seen) {
      if (p.value == null) continue;
      metrics.push({
        key: `personal:${key}`,
        label: labelFor(p.metric_name),
        text: `${round1(p.value)}${p.unit ? ` ${p.unit}` : ''}`,
        value: p.value,
      });
    }

    if (metrics.length === 0) continue;

    // The latest moment anything was recorded that day.
    const moments = [
      ...dayReadings.map((r) => r.measured_at),
      ...[...seen.values()].map((p) => p.measured_at ?? p.created_at),
    ]
      .filter((s): s is string => typeof s === 'string')
      .sort();
    const last = moments[moments.length - 1];

    out.push({ dayKey, date, loggedAt: last ? new Date(last) : null, metrics });
  }

  return out.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

/** "55.6 kg · 27.4% · 38.0 kg", the one-line summary on a collapsed card. */
export function summaryLine(day: MeasurementDay): string {
  return day.metrics.map((m) => m.text).join('  ·  ');
}

/** "Logged 8:13 am", or null when the time is not known. */
export function loggedAtLabel(day: MeasurementDay): string | null {
  if (!day.loggedAt) return null;
  let h = day.loggedAt.getHours();
  const m = day.loggedAt.getMinutes();
  const suffix = h < 12 ? 'am' : 'pm';
  h = h % 12 === 0 ? 12 : h % 12;
  return `Logged ${h}:${String(m).padStart(2, '0')} ${suffix}`;
}
