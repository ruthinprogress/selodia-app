// Pure week-addressing utilities for the Food weekly table and any other
// week-scoped view (the Food log / weekly-table host). Everything downstream is
// addressed by a weekStart date, never by "today" — so a default mount, a tap,
// and a future chat deep-link all drive the same view through one entry point.
// UK weeks start Monday. Dates here are calendar days in the device's LOCAL
// timezone on purpose: a logged entry is grouped by the day the person actually
// experienced it, which a UTC day boundary would get wrong near midnight.

// Local-midnight Date for the calendar day containing `d` (drops the time).
function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// A calendar day as YYYY-MM-DD in LOCAL time. Not toISOString(): that converts
// to UTC first, so a 23:30 local log could land on the wrong day.
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Monday of the week containing `d`, at local midnight.
export function weekStartFor(d: Date): Date {
  const start = localMidnight(d);
  const dow = start.getDay(); // 0=Sun .. 6=Sat
  const backToMonday = (dow + 6) % 7; // Mon->0, Tue->1, ... Sun->6
  start.setDate(start.getDate() - backToMonday);
  return start;
}

// The Monday-start of the current week.
export function currentWeekStart(now: Date = new Date()): Date {
  return weekStartFor(now);
}

// Add n weeks (n may be negative) to a week-start, returning local midnight.
// Rebuilt via the date parts so it stays correct across DST shifts.
export function addWeeks(weekStart: Date, n: number): Date {
  const d = localMidnight(weekStart);
  d.setDate(d.getDate() + n * 7);
  return d;
}

// The seven local-midnight dates Mon..Sun for the week starting at weekStart.
export function daysOfWeek(weekStart: Date): Date[] {
  const base = localMidnight(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = localMidnight(base);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// Half-open [startISO, endISO) instants covering the whole local week, for a
// timestamptz query: happened_at >= startISO and < endISO. Built from local
// midnights so it captures exactly the seven local days regardless of offset.
export function weekRange(weekStart: Date): { startISO: string; endISO: string } {
  const start = localMidnight(weekStart);
  const end = addWeeks(start, 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// Parse a weekStart param (YYYY-MM-DD) to the Monday-start of its week, or null
// if unparseable — so any caller (a tap, or a deep-link handing over an
// arbitrary date) is snapped to a valid week and bad input falls back safely.
export function parseWeekStartParam(v: string | undefined | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  // Reject out-of-range parts (e.g. month 13, day 40) that Date would silently
  // roll over into a different, valid date — a deep-link must not resolve junk.
  if (isNaN(d.getTime()) || d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) {
    return null;
  }
  return weekStartFor(d);
}

// Short day-section label, e.g. "Mon 11". Presentational; locale-formatted.
export function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

// Week-range label for the view header, e.g. "11–17 Aug". Presentational.
export function weekLabel(weekStart: Date): string {
  const days = daysOfWeek(weekStart);
  const first = days[0];
  const last = days[6];
  const dayNum = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric' });
  const monthShort = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  const sameMonth = first.getMonth() === last.getMonth();
  return sameMonth
    ? `${dayNum(first)}–${dayNum(last)} ${monthShort(last)}`
    : `${dayNum(first)} ${monthShort(first)} – ${dayNum(last)} ${monthShort(last)}`;
}
