// Which week a roundup belongs to, and whether one is owed (Insights slice 3).
//
// THE WEEK IS MONDAY TO SUNDAY, named by its Sunday. A roundup is a Sunday
// evening thing (Ruth's Insights brief), so the Sunday that closes a week is the
// natural name for it: one entry per week, and "has this week been rounded up?"
// is a string comparison rather than a range query.
//
// WHY A BOUNDARY HOUR AT ALL. Sunday is only over when the evening comes. A
// roundup generated at 9am on Sunday would summarise a week whose last day had
// barely started, and would then be the week's only roundup. So Sunday counts as
// complete from ROUNDUP_HOUR, and before that the most recent complete week is
// the one before.
//
// ONLY THE MOST RECENT WEEK IS EVER OWED. Someone who does not open the app for
// a fortnight gets last week's roundup, not two. A roundup is a reflection
// offered at the end of a week, and one handed over ten days late alongside a
// fresher one is a backlog, not a reflection.

export const ROUNDUP_HOUR = 18;

// The portrait's witness statements look back further than one week (the brief:
// 2-3 statements covering the last 6 weeks), so a roundup reads its recent
// predecessors as well as its own week.
export const PORTRAIT_WEEKS = 6;
export const PORTRAIT_RANGE_LABEL = 'the last 6 weeks';

const DAY_MS = 86_400_000;

/** A local calendar date as YYYY-MM-DD. Local, never UTC: a week boundary that
 *  moves with the timezone would put Sunday night's roundup on Monday. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local date, or null. */
export function parseIsoDate(s: unknown): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}

/** The Sunday closing the most recent COMPLETE week, as YYYY-MM-DD. */
export function weekEndingFor(now: Date): string {
  const day = now.getDay(); // 0 = Sunday
  if (day === 0 && now.getHours() >= ROUNDUP_HOUR) return isoDate(now);
  // Days back to the previous Sunday: 7 on a Sunday that is not yet complete.
  const back = day === 0 ? 7 : day;
  return isoDate(new Date(now.getTime() - back * DAY_MS));
}

/** The seven dates of the week ending on `weekEnding`, Monday first. */
export function weekDatesEnding(weekEnding: string): string[] {
  const sunday = parseIsoDate(weekEnding);
  if (!sunday) return [];
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(isoDate(new Date(sunday.getTime() - i * DAY_MS)));
  return out;
}

/** The Sunday `weeks` weeks before `weekEnding`, for the portrait's window. */
export function weekEndingMinus(weekEnding: string, weeks: number): string {
  const sunday = parseIsoDate(weekEnding);
  if (!sunday) return weekEnding;
  return isoDate(new Date(sunday.getTime() - weeks * 7 * DAY_MS));
}

/**
 * Is this a week the app may round up? It must be a real Sunday, and it must be
 * complete. The phone computes the week in the person's own timezone and sends
 * it, so the server checks rather than trusts: a future week would summarise
 * days that have not happened.
 */
export function isValidWeekEnding(v: unknown, now: Date): boolean {
  const d = parseIsoDate(v);
  if (!d || d.getDay() !== 0) return false;
  return (v as string) <= weekEndingFor(now);
}

// The witness statements, as they arrive from the model.
//
// The brief says 2 to 3, warm and specific. Anything else is dropped rather than
// padded: an invented statement in the portrait is exactly the "fake data" Ruth
// ruled out, and a missing one costs nothing because the portrait renders what
// it is given.
export const MAX_STATEMENTS = 3;
const MAX_STATEMENT_CHARS = 200;

export function coerceStatements(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t) continue;
    out.push(t.length > MAX_STATEMENT_CHARS ? `${t.slice(0, MAX_STATEMENT_CHARS - 1).trimEnd()}…` : t);
    if (out.length === MAX_STATEMENTS) break;
  }
  return out;
}

// What a roundup entry stores. The keys with two underscores are plumbing: the
// Almanac's content reader hides them, so the card and the detail view show the
// roundup itself and nothing else (see mobile/src/lib/almanac-content.ts).
export type RoundupContent = {
  summary: string;
  __weekEnding: string;
  __theme: string | null;
  __statements: string[];
  __statementsRange: string;
};

export function roundupContent(input: {
  reply: string;
  weekEnding: string;
  theme?: string | null;
  statements: string[];
}): RoundupContent {
  return {
    summary: input.reply.trim(),
    __weekEnding: input.weekEnding,
    __theme: input.theme?.trim() || null,
    __statements: input.statements,
    __statementsRange: PORTRAIT_RANGE_LABEL,
  };
}

/** The title on the card. Dated rather than clever: the log is chronological and
 *  every roundup is the same kind of thing, so the week is what tells them apart. */
export function roundupTitle(weekEnding: string): string {
  const d = parseIsoDate(weekEnding);
  if (!d) return 'Weekly roundup';
  const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Week to ${label}`;
}
