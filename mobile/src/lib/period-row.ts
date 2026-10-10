// THE PERIOD ROW'S THREE STATES.
//
// Ruth, 9 October 2026: "There is something missing, and that's how to say when
// the period ended."
//
// The row before this offered two buttons side by side - "Started sat 1 aug" and
// "Ended sat 1 aug" - which are not two states, they are two writes, and the row
// said nothing about where she actually was. A row that only ever offers to
// start a period is why there was no way to end one.
//
// From the build spec, 9 October:
//
//   NOT BLEEDING  "Period started today". That is the whole row.
//   BLEEDING      "Day 3 of your period", then "It's stopped" and "Choose the day".
//   JUST ENDED    "That cycle is closed. 5 days." Then back to the first state.
//
// Pure, and `today` is passed rather than read, so the check can sit a fixed
// date against fixed events.

export type CycleEvent = { event_date: string; event_type: string };

export type BleedState =
  | { state: 'bleeding'; start: string; dayOfPeriod: number }
  | { state: 'not-bleeding' };

/** How far back "Choose the day" offers. A fortnight covers remembering late without being a calendar. */
export const CHOOSABLE_DAYS = 14;

function dayOf(e: CycleEvent): string | null {
  const d = (e.event_date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function datesOf(events: CycleEvent[], type: string): string[] {
  const out = new Set<string>();
  for (const e of events) {
    if (e.event_type !== type) continue;
    const d = dayOf(e);
    if (d) out.add(d);
  }
  return [...out].sort();
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : NaN;
}

/**
 * Whether she is bleeding now, and which day of it.
 *
 * A start with no end ON OR AFTER IT is an open period. The "on" matters: a
 * period that started and stopped the same day is over, and treating the end as
 * having to come strictly later would have left it open for ever.
 *
 * A start in the FUTURE is not bleeding now. That cannot be reached from this
 * screen, which only offers today and the fortnight behind it, but it can be
 * reached from chat ("my period starts tomorrow"), and day 0 of a period is not
 * a sentence anyone should be shown.
 */
export function bleedState(events: CycleEvent[], today: string): BleedState {
  const starts = datesOf(events, 'period_start').filter((d) => d <= today);
  const ends = datesOf(events, 'period_end');
  const start = starts.length > 0 ? starts[starts.length - 1] : null;
  if (!start) return { state: 'not-bleeding' };
  if (ends.some((e) => e >= start)) return { state: 'not-bleeding' };
  const n = daysBetween(start, today);
  if (!Number.isFinite(n)) return { state: 'not-bleeding' };
  return { state: 'bleeding', start, dayOfPeriod: Math.max(1, n + 1) };
}

/**
 * How many days the most recently finished period ran, or null if none has.
 *
 * Inclusive of both ends, because a period that started and stopped on the same
 * day lasted one day and not nought.
 */
export function lastBleedLength(events: CycleEvent[]): number | null {
  const starts = datesOf(events, 'period_start');
  const ends = datesOf(events, 'period_end');
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    const start = starts[i];
    const after = starts[i + 1] ?? null;
    const end = ends.find((e) => e >= start && (!after || e < after));
    if (!end) continue;
    const n = daysBetween(start, end);
    if (Number.isFinite(n)) return n + 1;
  }
  return null;
}

/** Today and the days behind it, newest first, for "Choose the day". */
export function recentDays(today: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) out.push(iso);
  }
  return out;
}
