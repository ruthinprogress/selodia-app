// ONE CYCLE, ONE BAR.
//
// Ruth, 9 October 2026, on the cycle history as it was: "it's just a long list
// atm". It was a vertical list of dated events - "Period started, 28
// September", "Period ended, 2 October" - accurate and telling her nothing she
// could not already remember.
//
// A bar per cycle, length proportional to the cycle, the bleed shaded at the
// start. Six stacked show that 24 days followed 35, which is the one thing a
// list genuinely cannot do and the one thing that matters at her age: an
// irregular cycle is information, not noise to be averaged into a tidy 28.
//
// A MISSING CYCLE IS A ROW, NOT AN ABSENCE. A month with no period logged gets
// a dashed empty bar saying so. Dropping it would hide a skipped cycle, which
// is among the most meaningful things that can happen in perimenopause - the
// app would be quietest exactly when it should not be.
//
// THE MONTH A CYCLE BELONGS TO IS THE MONTH ITS PERIOD STARTED. Ruth, the same
// day: "i think the month the period starts is the month it's assigned to". So
// a cycle running 20 September to 21 October is September's.

import { periodStarts, type CycleEvent } from '@/lib/cycle-history';

export type CycleBar = {
  /** ISO date the period started. The key for the row. */
  start: string;
  /** ISO date the next period started, or null for the cycle she is in. */
  next: string | null;
  /** Whole days, or null while it is still running. */
  length: number | null;
  /** Days of bleeding, or null when she never marked an end. */
  bleed: number | null;
  /** Days so far. Only meaningful on the open cycle, where length is null. */
  soFar: number | null;
  /** The month this cycle is filed under: the month it started. */
  label: string;
};

const MS = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / MS);
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Period ends, oldest first, one per day. Mirrors periodStarts. */
function periodEnds(events: CycleEvent[]): string[] {
  const days = new Set<string>();
  for (const e of events) {
    if (e.event_type !== 'period_end') continue;
    const day = (e.event_date ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) days.add(day);
  }
  return [...days].sort();
}

/**
 * The bars, NEWEST FIRST, which is the order they are read in.
 *
 * `today` is passed rather than read so this stays pure and the check can sit
 * a fixed date against fixed events.
 */
export function cycleBars(events: CycleEvent[], today: string): CycleBar[] {
  const starts = periodStarts(events);
  const ends = periodEnds(events);
  if (starts.length === 0) return [];

  const bars: CycleBar[] = starts.map((start, i) => {
    const next = i + 1 < starts.length ? starts[i + 1] : null;
    const length = next ? daysBetween(start, next) : null;
    // The first end on or after this start, and before the next one. A bleed
    // with no end marked stays null rather than being guessed at five days -
    // a made-up bleed length is a made-up bar.
    const end = ends.find((e) => e >= start && (!next || e < next)) ?? null;
    const bleed = end ? daysBetween(start, end) + 1 : null;
    return {
      start,
      next,
      length,
      bleed,
      soFar: next ? null : Math.max(1, daysBetween(start, today) + 1),
      label: monthLabel(start),
    };
  });

  return withGaps(bars).reverse();
}

/**
 * How long an interval has to be before a period is genuinely missing.
 *
 * NOT "a month with no period start in it", which was the first version and
 * was wrong: 30 January to 2 March is an ordinary 31-day cycle and February
 * contains no start, so that rule called a perfectly healthy cycle a skipped
 * one. Flagging a normal month as a gap in an app for women in perimenopause
 * is not a cosmetic error - a skipped period is a real signal and an invented
 * one is a false alarm about exactly the thing she is watching for.
 *
 * 45 days: comfortably past the longest ordinary cycle, well short of the 60
 * that cycle-history already treats as implausible.
 */
const SKIPPED_AFTER_DAYS = 45;

/**
 * Insert a row for a month swallowed by an interval too long to be one cycle.
 *
 * A gap is only visible if something occupies it. Two bars adjacent in a list
 * say nothing about the four months between them.
 */
function withGaps(bars: CycleBar[]): CycleBar[] {
  const out: CycleBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    out.push(bars[i]);
    const next = bars[i + 1];
    if (!next) continue;
    if (daysBetween(bars[i].start, next.start) <= SKIPPED_AFTER_DAYS) continue;
    const months = monthsBetween(bars[i].start, next.start);
    for (const m of months) {
      out.push({
        start: m,
        next: null,
        length: null,
        bleed: null,
        soFar: null,
        label: monthLabel(m),
      });
    }
  }
  return out;
}

/** First days of whole months strictly between two dates with no period start. */
function monthsBetween(a: string, b: string): string[] {
  const out: string[] = [];
  const from = new Date(`${a}T12:00:00Z`);
  const to = new Date(`${b}T12:00:00Z`);
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  while (cursor < to) {
    // Only when the whole month is clear: a cycle starting on the 30th and the
    // next on the 2nd of the month after next has not skipped anything.
    const sameAsNext =
      cursor.getUTCFullYear() === to.getUTCFullYear() && cursor.getUTCMonth() === to.getUTCMonth();
    if (!sameAsNext) out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

/** True when this row is a month with nothing in it rather than a real cycle. */
export function isGap(bar: CycleBar): boolean {
  return bar.length === null && bar.soFar === null;
}

export type CycleSummary = {
  /** Day of the cycle she is in, or null when no period has been logged. */
  dayNow: number | null;
  /** The last three completed lengths, newest first. */
  recent: number[];
  shortest: number | null;
  longest: number | null;
};

/**
 * The line above the bars: "You are on day 18. Your last three were 26, 35 and
 * 24 days. A range of 24 to 35."
 *
 * From ChatGPT's second direction, where it was the strongest thing on the
 * page - it does more work than any of the charts, because it says the thing
 * the charts are only showing.
 */
export function cycleSummary(bars: CycleBar[]): CycleSummary {
  const open = bars.find((b) => b.soFar !== null) ?? null;
  const lengths = bars
    .filter((b) => b.length !== null)
    .map((b) => b.length as number);
  const recent = lengths.slice(0, 3);
  return {
    dayNow: open?.soFar ?? null,
    recent,
    shortest: lengths.length > 0 ? Math.min(...lengths) : null,
    longest: lengths.length > 0 ? Math.max(...lengths) : null,
  };
}

/**
 * The summary as a sentence, or null when there is not enough to say one.
 *
 * NO PREDICTION, EVER. Her cycles ran 24, 35 and 26 in three months; a
 * confident next date would be wrong more often than right, and being wrong
 * about this is worse than being silent.
 */
export function summaryLines(s: CycleSummary): string[] | null {
  if (s.dayNow === null) return null;
  const lines = [`You are on day ${s.dayNow} of this cycle.`];
  if (s.recent.length >= 2) {
    const list =
      s.recent.length === 2
        ? `${s.recent[0]} and ${s.recent[1]}`
        : `${s.recent.slice(0, -1).join(', ')} and ${s.recent[s.recent.length - 1]}`;
    lines.push(`Your last ${s.recent.length === 2 ? 'two' : 'three'} were ${list} days.`);
  }
  if (s.shortest !== null && s.longest !== null && s.shortest !== s.longest) {
    lines.push(`A range of ${s.shortest} to ${s.longest}.`);
  }
  return lines;
}
