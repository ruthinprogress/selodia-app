import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type Alignment,
  alongside,
  compare,
  type Comparison,
  coverage,
  type PatternVerdict,
  shiftDay,
  verdict,
} from './pattern-check';

// FINDING THE DAYS SOMETHING HAPPENED (21 September 2026).
//
// "could the user say, run a report on all days i drank cocktails and my mood
// the following days?"
//
// The arithmetic lives in pattern-check.ts. This is the part that goes and
// gets the days, and the part where the honesty is easiest to lose, because a
// search that quietly misses half her nights out produces a confident table
// about five days instead of eleven.
//
// SO IT SAYS WHAT IT SEARCHED AND HOW FAR BACK. Every answer carries the window
// and the count, and the model is told to pass them on. "Nothing found" and
// "nothing found in the last ninety days" are different sentences, and only one
// of them is true.
//
// A SUBSTRING, DELIBERATELY. "cocktail" finds cocktails, "wine" finds red wine
// and a glass of wine. It will also find "pineapple" inside nothing useful and
// miss a mojito logged as a mojito - and the way that failure is handled is by
// showing which entries matched, so a search that found the wrong thing is
// visible in the answer rather than buried in an average.

export const DEFAULT_WINDOW_DAYS = 120;

export type PatternMatch = { day: string; what: string };

export type PatternResult = {
  trigger: string;
  measure: string;
  offsets: number[];
  windowDays: number;
  since: string;
  matches: PatternMatch[];
  rows: Alignment[];
  cover: { have: number; of: number };
  comparison: Comparison;
  verdict: PatternVerdict;
};

/** Postgres LIKE wildcards in somebody's own words are theirs, not operators. */
function likeSafe(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function dayOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Days a term appears in what they ate, drank or did.
 *
 * FOOD AND ACTIVITY BOTH, because "days I drank cocktails" and "days I ran
 * more than an hour" are the same question wearing different clothes, and
 * somebody asking the first will ask the second next.
 */
export async function daysMatching(
  supabase: SupabaseClient,
  userId: string,
  term: string,
  since: string
): Promise<PatternMatch[]> {
  const needle = `%${likeSafe(term.trim())}%`;
  const found: PatternMatch[] = [];

  const { data: foods } = await supabase
    .from('food_logs')
    .select('happened_at, raw_text')
    .eq('user_id', userId)
    .gte('happened_at', `${since}T00:00:00Z`)
    .ilike('raw_text', needle)
    .order('happened_at', { ascending: true })
    .limit(400);
  for (const f of (foods ?? []) as { happened_at: string; raw_text: string | null }[]) {
    found.push({ day: dayOf(f.happened_at), what: f.raw_text ?? term });
  }

  // THE ITEMS TOO. A meal logged as "dinner out" itemises into a mojito, and a
  // search that only read the sentence would miss the night entirely - which is
  // the failure that turns eleven nights into five without saying so.
  const { data: items } = await supabase
    .from('food_items')
    .select('name, food_logs!inner(happened_at, user_id)')
    .eq('user_id', userId)
    .gte('food_logs.happened_at', `${since}T00:00:00Z`)
    .ilike('name', needle)
    .limit(400);
  // The embedded row comes back as an array in the generated types even though
  // the join is one-to-one, so both shapes are read rather than cast past.
  for (const it of (items ?? []) as { name: string; food_logs: { happened_at: string }[] | { happened_at: string } | null }[]) {
    const log = Array.isArray(it.food_logs) ? it.food_logs[0] : it.food_logs;
    if (log?.happened_at) found.push({ day: dayOf(log.happened_at), what: it.name });
  }

  const { data: acts } = await supabase
    .from('activity_logs')
    .select('happened_at, activity_type, raw_input')
    .eq('user_id', userId)
    .gte('happened_at', `${since}T00:00:00Z`)
    .or(`activity_type.ilike.${needle},raw_input.ilike.${needle}`)
    .order('happened_at', { ascending: true })
    .limit(400);
  for (const a of (acts ?? []) as { happened_at: string; activity_type: string | null; raw_input: string | null }[]) {
    found.push({ day: dayOf(a.happened_at), what: a.activity_type ?? a.raw_input ?? term });
  }

  // ONE ENTRY PER DAY IN WHAT SHE IS SHOWN. Three drinks on one night is one
  // night, and a table listing it three times would read as three occasions.
  const byDay = new Map<string, string>();
  for (const m of found) if (!byDay.has(m.day)) byDay.set(m.day, m.what);
  return [...byDay.entries()].sort().map(([day, what]) => ({ day, what }));
}

/**
 * The whole answer to "those days, and how I felt after".
 *
 * Nothing in here decides anything. It gathers, lines up, counts, and hands
 * back figures the model is forbidden to recompute.
 */
export async function runPatternCheck(
  supabase: SupabaseClient,
  userId: string,
  opts: { trigger: string; measure: string; offsets: number[]; today: string; windowDays?: number }
): Promise<PatternResult> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = shiftDay(opts.today, -windowDays);

  const matches = await daysMatching(supabase, userId, opts.trigger, since);

  // The ratings window has to reach PAST the last matching day, or the days
  // after the final occasion would be missing for no reason but arithmetic.
  const { data: ratingRows } = await supabase
    .from('daily_ratings')
    .select('day, measure, value')
    .eq('user_id', userId)
    .eq('measure', opts.measure)
    .gte('day', since)
    .lte('day', shiftDay(opts.today, 7))
    .limit(1000);
  const ratings = (ratingRows ?? []) as { day: string; measure: string; value: number }[];

  const rows = alongside(matches.map((m) => m.day), ratings, opts.offsets, opts.measure);
  const cover = coverage(rows);

  return {
    trigger: opts.trigger.trim(),
    measure: opts.measure,
    offsets: opts.offsets,
    windowDays,
    since,
    matches,
    rows,
    cover,
    comparison: compare(rows, ratings, opts.offsets, opts.measure),
    verdict: verdict(rows, cover),
  };
}
