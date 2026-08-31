import type { SupabaseClient } from '@supabase/supabase-js';

// The 9-week consistent-logging window (Part Fourteen, build item 14).
//
// INTERNAL STATE ONLY. Nothing here renders, and nothing may render it. Decided
// 2026-08-31: no bar, no progress indicator, no visible streak of any kind. This
// exists so the app knows where someone is in the 9-week cycle, for two callers
// that are not built yet — the adaptive reminder taper (Part Fourteen) and
// Graduation's lite-mode pausing (Part Eleven, build item 24).
//
// The reason for the no-UI rule is worth keeping next to the code rather than
// only in a decision log. A 9-week bar that fills as you comply IS a streak,
// whatever it is called: it counts consecutive days and its whole visual grammar
// says do not break this. That is exactly what Part Twelve forbade for hydration
// — "no streaks, no 'don't break the chain' framing… never a performance record
// to protect or a run to preserve" — and the reasoning there was not specific to
// water. Principle 3 draws the same line from the other side: a feature that
// only makes sense for an app maximising daily engagement is the wrong feature
// here. So the state exists and stays behind the glass.
//
// COMPUTED, NEVER STORED, and this is the load-bearing decision. The spec says
// "Retrospective catch-up entries count", and the app genuinely supports
// backfilling — food-logging.ts and activity-logging.ts both accept happenedAt,
// and the parser resolves "yesterday" and "on Monday". A stored counter would be
// WRONG the instant someone logs a day they missed: the count would have to be
// recomputed anyway, so storing it buys nothing and adds a way to be stale. A
// query over the window is correct by construction, and needs no schema change.
//
// KNOWN FOLLOW-UP, deliberately not done here: food_logs carries only a user_id
// index, where hydration_logs and daily_summaries both carry a composite
// (user_id, <time> desc). This query filters a 63-day range per user, so it
// would benefit from the same shape. Left alone because it is not strictly
// necessary at current data volumes, and an index is still a schema change.

// Nine weeks, per Part Fourteen. Expressed as weeks × 7 so the derivation stays
// visible — 63 on its own is a number someone would eventually "tidy" to 60.
export const HABIT_WINDOW_WEEKS = 9;
export const HABIT_WINDOW_DAYS = HABIT_WINDOW_WEEKS * 7;

export type HabitWindow = {
  windowDays: number;
  // Days in the window carrying at least one FOOD entry. Food only, per the
  // spec's "full" day definition — measurements and activity are explicitly not
  // held to a daily standard, and counting them would mark ordinary days as
  // failures.
  fullDays: number;
  // The spec's bar is 100%, not a majority: "Consistent is defined as 100% for
  // food logs specifically over a 9-week window". Deliberately strict, and
  // deliberately not softened here — softening it would quietly change when the
  // taper fires.
  isConsistent: boolean;
  // Trailing consecutive full days, ending on the window's last day. Not a
  // streak to display; it is how a caller answers "how far off is this person"
  // without recomputing the window itself.
  currentRunDays: number;
  // The gaps, oldest first. Kept because "which days were missed" is the useful
  // answer when something needs to explain itself, and recomputing it later
  // would mean a second pass over the same rows.
  missedDates: string[];
};

// The window's calendar days, oldest first, ending on endDate inclusive.
// Calendar days rather than timestamps: a day is a day in someone's life, and a
// boundary that moved with the clock would make the same window answer
// differently depending on when it was asked.
export function habitWindowDates(endDate: Date, windowDays = HABIT_WINDOW_DAYS): string[] {
  const out: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  return out;
}

// Pure: the set of dates that had food, against the window's dates.
export function computeHabitWindow(fullDates: ReadonlySet<string>, dates: string[]): HabitWindow {
  const missedDates = dates.filter((d) => !fullDates.has(d));
  const fullDays = dates.length - missedDates.length;

  let currentRunDays = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (!fullDates.has(dates[i])) break;
    currentRunDays++;
  }

  return {
    windowDays: dates.length,
    fullDays,
    isConsistent: dates.length > 0 && fullDays === dates.length,
    currentRunDays,
    missedDates,
  };
}

// THE ENTRY POINT the taper and Graduation should call. One function, so those
// two can never drift into two different definitions of the same nine weeks.
//
// RLS scopes food_logs to the signed-in user, so this reads whoever the client
// is authenticated as — the same pattern the roundup routes use.
export async function loadHabitWindow(
  supabase: SupabaseClient,
  endDate: Date = new Date(),
  windowDays = HABIT_WINDOW_DAYS
): Promise<HabitWindow> {
  const dates = habitWindowDates(endDate, windowDays);
  const windowStart = new Date(`${dates[0]}T00:00:00.000Z`).toISOString();

  const { data, error } = await supabase
    .from('food_logs')
    .select('happened_at')
    .gte('happened_at', windowStart);

  if (error) {
    // An unreadable window is not a window of zeroes. Reporting 0 full days
    // would tell the taper this person has logged nothing in nine weeks, which
    // could fire a check-in built for a very different situation. Better to hand
    // back a window that is honestly empty of days than one that lies about them.
    return {
      windowDays: 0,
      fullDays: 0,
      isConsistent: false,
      currentRunDays: 0,
      missedDates: [],
    };
  }

  const fullDates = new Set<string>();
  for (const row of data ?? []) {
    const d = String(row.happened_at ?? '').slice(0, 10);
    if (d) fullDates.add(d);
  }

  return computeHabitWindow(fullDates, dates);
}
