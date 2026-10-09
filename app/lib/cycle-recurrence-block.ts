// THE CROSS-CYCLE LINE, ASSEMBLED FOR THE PROMPT.
//
// Three pieces exist separately and this joins them for one turn:
//   cycle-position.ts  where a day sits, and when two days are the same place
//   day-observations.ts  what was logged on which day
//   symptom-lookback.ts  which of today's symptoms have been there before
//
// Kept out of the route because the route is already four thousand lines and
// because the join is the interesting part - it is the thing that turns three
// correct libraries into "you logged this around this point in August and July
// too", which is the sentence the whole cycle redesign exists to produce.
//
// TWO READS, BOTH SMALL, AND DELIBERATELY NOT IN turn_context. That RPC is a
// Postgres function returning one JSON blob for every turn; widening it for a
// feature only cycle-aware turns need would make every other turn pay for it.
// These run in parallel with it instead.

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildCycles } from './cycle-position';
import { localDayKey, symptomDays } from './day-observations';
import { lookbackPrompt, recurrences, type Recurrence } from './symptom-lookback';

export type CycleRecurrences = {
  found: Recurrence[];
  /** The prompt block, or '' when there is nothing worth saying. */
  block: string;
};

const EMPTY: CycleRecurrences = { found: [], block: '' };

/**
 * What has happened at this point in the cycle before, for the day given.
 *
 * Returns EMPTY rather than throwing on any failure. A turn must never fail
 * because an observation about a pattern could not be assembled: the worst
 * acceptable outcome is that it says nothing extra, and the best possible
 * outcome of this function was only ever one more sentence.
 */
export async function cycleRecurrencesFor(
  supabase: SupabaseClient,
  userId: string,
  day: string = localDayKey()
): Promise<CycleRecurrences> {
  try {
    const [startsResult, history] = await Promise.all([
      supabase
        .from('cycle_events')
        .select('event_date')
        .eq('user_id', userId)
        .eq('event_type', 'period_start')
        .order('event_date', { ascending: true })
        .limit(40),
      symptomDays(supabase, userId),
    ]);

    if (startsResult.error) {
      console.log('CYCLE RECURRENCE: period history unreadable -', startsResult.error.message);
      return EMPTY;
    }

    const starts = (startsResult.data ?? []).map((r) => String((r as { event_date: unknown }).event_date));
    // ONE PERIOD IS NOT A CYCLE. With a single start there is nothing to
    // compare against and no length to judge comparability by, so the honest
    // answer is silence rather than a pattern from a sample of one.
    if (starts.length < 2) return EMPTY;

    const found = recurrences(buildCycles(starts), history, day);
    return { found, block: lookbackPrompt(found) };
  } catch (err) {
    console.log('CYCLE RECURRENCE threw:', err instanceof Error ? err.message : err);
    return EMPTY;
  }
}
