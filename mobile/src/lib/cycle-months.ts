import { completedCycles, periodStarts, type CycleEvent } from '@/lib/cycle-history';

// THE CYCLE SCREEN AS A RECORD OF MONTHS.
//
// Ruth's artwork, 21 October 2026, eight screens: an overview listing her
// months newest first, each one opening onto a summary of that cycle, each day
// of it opening onto what she logged. The screen before this was a period
// button, a door and a row of bars - it recorded, but it could not be READ.
//
// ONE ROW PER CYCLE, NAMED BY THE MONTH IT STARTED. Her drawing says "August
// 2026 - 34 days - 4 days bleed", so the row is a cycle and the month is only
// its name. A cycle that starts on the 30th of August and runs into September
// is August's, because that is the one she would look for.
//
// THREE STATES, AND THE DRAWING NAMES ALL THREE:
//
//   October     Day 3      Ongoing          - the current one, counting
//   September   22 days    End not logged   - complete, but the bleed is unknown
//   August      34 days    4 days bleed     - complete and whole
//
// "END NOT LOGGED" IS THE ONE WORTH HAVING. A period that was never closed is
// the commonest gap in this record - she said so herself when the end button
// was built: "There is something missing, and that's how to say when the period
// ended." Saying so on the row is how she finds the one to fix, instead of the
// app quietly averaging a bleed length it never knew.
//
// AND A LENGTH IS NEVER GUESSED. A cycle is only as long as the gap to the NEXT
// recorded start; the current one has no length at all, only a day number. The
// same refusal completedCycles already makes, carried onto the screen.

export type CycleMonth = {
  /** The date the period started. The row's identity, and what a tap opens. */
  start: string;
  /** "August", for the heading. */
  monthLabel: string;
  year: number;
  /** Days to the next recorded start, or null while this one is still running. */
  lengthDays: number | null;
  /** Days of bleeding, inclusive, or null when the end was never recorded. */
  bleedDays: number | null;
  /** True for the one she is in now. */
  ongoing: boolean;
  /** Day of cycle, for the ongoing one only. */
  dayOfCycle: number | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** A date key read as a local date, with no timezone involved. */
function parts(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function asDate(key: string): Date | null {
  const p = parts(key);
  return p ? new Date(p.y, p.m - 1, p.d) : null;
}

/** Whole days from one date key to another. Positive when b is later. */
export function daysApart(a: string, b: string): number | null {
  const x = asDate(a);
  const y = asDate(b);
  if (!x || !y) return null;
  return Math.round((y.getTime() - x.getTime()) / 86_400_000);
}

/**
 * How many days she bled, counting both ends.
 *
 * THE END BELONGS TO THE START IT FOLLOWS. An end recorded after the next
 * period has already begun is not this period's end - it is a stray row, and
 * pairing them would report a bleed longer than the cycle that held it.
 */
export function bleedLength(
  events: CycleEvent[],
  start: string,
  nextStart: string | null
): number | null {
  const ends = events
    .filter((e) => e.event_type === 'period_end' && e.event_date >= start)
    .filter((e) => nextStart == null || e.event_date < nextStart)
    .map((e) => e.event_date)
    .sort();
  if (ends.length === 0) return null;
  const days = daysApart(start, ends[0]);
  if (days == null || days < 0) return null;
  return days + 1;
}

/**
 * Every cycle she has recorded, newest first.
 *
 * `today` is passed in rather than read, because the current cycle's day number
 * changes at midnight and a screen left open overnight should not be the thing
 * that decides what day it is.
 */
export function cycleMonths(events: CycleEvent[], today: string): CycleMonth[] {
  const starts = periodStarts(events);
  const rows: CycleMonth[] = [];

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const nextStart = i + 1 < starts.length ? starts[i + 1] : null;
    const p = parts(start);
    if (!p) continue;

    const ongoing = nextStart == null;
    const sinceStart = daysApart(start, today);
    rows.push({
      start,
      monthLabel: MONTHS[p.m - 1],
      year: p.y,
      lengthDays: nextStart ? daysApart(start, nextStart) : null,
      bleedDays: bleedLength(events, start, nextStart),
      ongoing,
      // A start in the future counts as day one rather than day zero or less;
      // the app lets her record one on a day she chooses, and a fat finger on
      // next week should not print "Day -4".
      dayOfCycle: ongoing && sinceStart != null ? Math.max(1, sinceStart + 1) : null,
    });
  }

  return rows.reverse();
}

/**
 * What each row is called on screen.
 *
 * TWO CYCLES CAN START IN ONE MONTH, and a short month after a short cycle is
 * all it takes. The first run of this printed "June" twice in a row, which
 * reads as a bug rather than as two cycles - so where a month repeats inside a
 * year, both get their day: "June 1", "June 29". Where it does not, the month
 * stands alone exactly as her drawing has it.
 */
export function monthTitles(rows: CycleMonth[]): string[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.year}-${r.monthLabel}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return rows.map((r) => {
    const key = `${r.year}-${r.monthLabel}`;
    if ((seen.get(key) ?? 0) < 2) return r.monthLabel;
    const p = parts(r.start);
    return p ? `${r.monthLabel} ${p.d}` : r.monthLabel;
  });
}

/** The months grouped under their year, newest year first, for the overview. */
export function byYear(rows: CycleMonth[]): { year: number; months: CycleMonth[] }[] {
  const out: { year: number; months: CycleMonth[] }[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && last.year === row.year) last.months.push(row);
    else out.push({ year: row.year, months: [row] });
  }
  return out;
}

/**
 * The second line of a row, in her drawing's own words.
 *
 * NOTHING HERE IS A JUDGEMENT. "End not logged" says what is missing from the
 * record and not that she did anything wrong, which is the difference between a
 * cycle app worth opening and one that keeps score.
 */
export function rowDetail(row: CycleMonth): string {
  if (row.ongoing) return 'Ongoing';
  if (row.bleedDays == null) return 'End not logged';
  return `${row.bleedDays} ${row.bleedDays === 1 ? 'day' : 'days'} bleed`;
}

/** The first line's right-hand side: "Day 3" while running, "34 days" once closed. */
export function rowLength(row: CycleMonth): string {
  if (row.ongoing) return row.dayOfCycle != null ? `Day ${row.dayOfCycle}` : '';
  return row.lengthDays != null ? `${row.lengthDays} days` : '';
}

/**
 * Her pattern, for the card at the top: "Average 27 days", "Range 22 - 34 days".
 *
 * RANGE IS THE REAL SPREAD, not the average plus a margin. knowledgeFrom holds
 * half the spread for the purposes of "give or take", which is the right shape
 * for a prediction and the wrong one for this card: she wants to see her
 * shortest and her longest, which are two facts rather than an interval.
 */
export function cyclePattern(events: CycleEvent[]): {
  average: number;
  shortest: number;
  longest: number;
  cycles: number;
} | null {
  const done = completedCycles(events);
  if (done.length === 0) return null;
  const lengths = done.map((c) => c.length);
  return {
    average: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    shortest: Math.min(...lengths),
    longest: Math.max(...lengths),
    cycles: done.length,
  };
}
