// Keeping whole-day tracker totals out of the session lists.
//
// A Samsung Health daily summary used to be written into `activity_logs` as an
// activity called "Daily Summary", carrying a whole day's burn as though it were
// one session's. Those rows have been moved to `daily_activity_summaries` and
// the parse route no longer creates them, so in the ordinary case there is
// nothing here to catch.
//
// IT IS STILL WORTH CATCHING. Two reasons, neither hypothetical: a phone running
// an older build keeps posting the old shape until the person updates, and the
// screenshot parse is a language model, which can always answer in a form it was
// asked not to. The consequence of missing one is that a person sees "1063 kcal"
// listed beside their real workouts - the exact bug this all exists to fix - and
// the consequence of a false positive is one row hidden from a list. Those costs
// are not symmetrical, so the check is deliberately broad.
//
// Shared rather than written twice: the Activity list and the Overview's
// movement minutes both need it, and two copies of a rule like this drift.

export type MaybeDailySummaryRow = {
  activity_type?: string | null;
  source?: string | null;
};

const DAILY_SUMMARY = /daily summary/i;

export function isDailySummaryRow(row: MaybeDailySummaryRow): boolean {
  return DAILY_SUMMARY.test(row.activity_type ?? '') || DAILY_SUMMARY.test(row.source ?? '');
}

export function withoutDailySummaries<T extends MaybeDailySummaryRow>(rows: T[]): T[] {
  return rows.filter((r) => !isDailySummaryRow(r));
}
