import { bleedLength, daysApart, type CycleMonth } from '@/lib/cycle-months';
import type { CycleEvent } from '@/lib/cycle-history';

// ONE CYCLE, SUMMARISED - SCREENS 2 AND 3 OF HER ARTWORK (21 October 2026).
//
//   34-day cycle
//   4-day bleed
//   Period 25 - 28 Aug        Logged on 9 days
//   Most common symptoms      Bloating (5)  Headache (3)  Brain fog (3)
//
// EVERY FIGURE HERE IS COUNTED, NOT ESTIMATED. "Logged on 9 days" is nine rows
// in daily_observations; the symptom counts are how many of those days named
// that symptom. Nothing is filled in from an average, because the whole value
// of this card is that it describes the cycle she actually had.
//
// AND A SYMPTOM NAMED ONCE IS NOT COMMON. The chips say "most common", so a
// list that includes everything mentioned once would be a list of everything -
// which is the state the old screen was in and the reason she called it "just
// a long list".

export type DayRow = {
  day: string;
  flow: string | null;
  symptoms: string[] | null;
  mucus: string | null;
  notes: string | null;
};

export type MonthSummary = {
  /** "34-day cycle", or null while it is still running. */
  lengthLabel: string | null;
  /** "4-day bleed", or null when the end was never recorded. */
  bleedLabel: string | null;
  /** "25 – 28 Aug", or just the start when there is no end. */
  periodLabel: string;
  loggedDays: number;
  common: { name: string; count: number }[];
};

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "25 Aug" from "2026-08-25". */
export function shortDay(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  return `${Number(m[3])} ${SHORT_MONTHS[Number(m[2]) - 1]}`;
}

/**
 * "25 – 28 Aug" where both days share a month, "28 Aug – 2 Sep" where they do not.
 *
 * HER DRAWING SAYS THE MONTH ONCE, and it is right to: a period that begins and
 * ends in August does not need August said twice, and the pair reads as one
 * span rather than as two dates. A bleed that crosses into the next month does
 * need both, and that is the one worth getting right - it is also the one a
 * reader would otherwise misread by a whole month.
 */
export function periodRange(start: string, end: string): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end);
  if (!a || !b) return `${shortDay(start)} – ${shortDay(end)}`;
  const sameMonth = a[1] === b[1] && a[2] === b[2];
  return sameMonth ? `${Number(a[3])} – ${shortDay(end)}` : `${shortDay(start)} – ${shortDay(end)}`;
}

/** Appears at least this often to count as one of the common ones. */
const COMMON_AT_LEAST = 2;

/** How many chips the card shows. Her drawing has three. */
const COMMON_SHOWN = 3;

export function monthSummary(
  row: CycleMonth,
  events: CycleEvent[],
  nextStart: string | null,
  days: DayRow[]
): MonthSummary {
  const bleed = bleedLength(events, row.start, nextStart);
  const end = bleed != null ? endDate(row.start, bleed) : null;

  const counts = new Map<string, number>();
  for (const d of days) {
    // ONE DAY IS ONE VOTE. A symptom written twice on the same day is still one
    // day of it, and counting the entries rather than the days would make a
    // fiddly morning look like a bad week.
    for (const s of new Set((d.symptoms ?? []).map((x) => String(x).trim()).filter(Boolean))) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  const common = [...counts.entries()]
    .filter(([, n]) => n >= COMMON_AT_LEAST)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, COMMON_SHOWN)
    .map(([name, count]) => ({ name, count }));

  return {
    lengthLabel: row.lengthDays != null ? `${row.lengthDays}-day cycle` : null,
    bleedLabel: bleed != null ? `${bleed}-day bleed` : null,
    periodLabel: end ? periodRange(row.start, end) : shortDay(row.start),
    loggedDays: days.length,
    common,
  };
}

/** The last day of bleeding, from the start and how many days it ran. */
export function endDate(start: string, bleedDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!m || bleedDays < 1) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + bleedDays - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A day's one-line summary for the list: "Light flow · Bloating".
 *
 * THE FLOW LEADS, because that is what the list is sorted around and what the
 * drop beside it is coloured by. Then whatever else she recorded, in the order
 * the day screen asks for it, so the line reads the way the day was filled in.
 */
export function dayLine(d: DayRow): string {
  const bits: string[] = [];
  if (d.flow) bits.push(`${cap(d.flow)} flow`);
  for (const s of (d.symptoms ?? []).slice(0, 3)) bits.push(cap(String(s)));
  if (bits.length === 0 && d.mucus) bits.push(cap(d.mucus));
  if (bits.length === 0 && d.notes) bits.push('Note');
  return bits.join(' · ');
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Which day of the cycle a date is, counting the start as day 1. */
export function dayOfCycle(start: string, day: string): number | null {
  const n = daysApart(start, day);
  return n == null || n < 0 ? null : n + 1;
}
