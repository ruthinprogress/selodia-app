import type { AlmanacRow } from '@/lib/insights';

// The phone's half of the Sunday roundup (Insights slice 3).
//
// WHY THE PHONE DECIDES WHICH WEEK. "Sunday evening" is Sunday evening where the
// person is, and the server has no reliable way to know that: a serverless
// function runs in UTC and the profile carries no timezone. So the phone names
// the week, in local time, and the server validates what it is handed (it will
// refuse a week that has not finished). The rule itself is deliberately the same
// as app/lib/roundup-week.ts, kept small enough to read side by side.
//
// ONLY THE MOST RECENT COMPLETE WEEK is ever owed. Two weeks away means one
// roundup on return, not a backlog.

export const ROUNDUP_HOUR = 18;

const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The Sunday closing the most recent complete week, in local time. */
export function weekEndingFor(now: Date = new Date()): string {
  const day = now.getDay();
  if (day === 0 && now.getHours() >= ROUNDUP_HOUR) return isoDate(now);
  return isoDate(new Date(now.getTime() - (day === 0 ? 7 : day) * DAY_MS));
}

/** The week a stored roundup entry covers, or null when it is not a roundup. */
export function roundupWeekEnding(row: Pick<AlmanacRow, 'kind' | 'content'>): string | null {
  const kind = typeof row.kind === 'string' ? row.kind.trim().toLowerCase() : '';
  if (kind !== 'roundup' && kind !== 'weekly roundup') return null;
  const content = row.content;
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return null;
  const week = (content as Record<string, unknown>).__weekEnding;
  return typeof week === 'string' && week.length > 0 ? week : null;
}

/** Has the week ending `weekEnding` already been rounded up? */
export function hasRoundupFor(rows: Pick<AlmanacRow, 'kind' | 'content'>[], weekEnding: string): boolean {
  return rows.some((r) => roundupWeekEnding(r) === weekEnding);
}

// The witness statements shown in the portrait: the newest roundup's, or none.
//
// Read from the entry rather than stored separately so they can never drift from
// the week that produced them, and so a person who has no roundups has no
// statements rather than a default set (Ruth: no fake data).
export type Portrait = { statements: string[]; range: string | null };

export function portraitFrom(rows: (Pick<AlmanacRow, 'kind' | 'content'> & { created_at: string })[]): Portrait {
  const roundups = rows
    .filter((r) => roundupWeekEnding(r) !== null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const content = roundups[0]?.content as Record<string, unknown> | undefined;
  const raw = content?.__statements;
  const statements = Array.isArray(raw)
    ? raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : [];
  const range = typeof content?.__statementsRange === 'string' ? content.__statementsRange : null;
  return { statements, range: statements.length > 0 ? range : null };
}
