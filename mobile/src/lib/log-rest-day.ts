import { coverageColumns } from '@/lib/coverage-columns';
import { supabase } from '@/lib/supabase';

// A REST DAY YOU CAN TAP.
//
// Ruth, 21 October 2026: "a tappable rest day on Today is nice... tap to
// choose, never automatic - definitely."
//
// NEVER AUTOMATIC, AND THAT IS THE WHOLE DESIGN. A day with nothing planned is
// not a rest day; it is a day with nothing planned. Writing one on her behalf
// would be the app inventing a record she did not make - the one thing it
// never does - and it would then have to be deleted the moment she logged
// something real. So the screen offers, and she decides.
//
// IT WAS ALREADY POSSIBLE AND NOBODY KNEW. "rest day today" in chat is handled
// explicitly, and skips the duration question that every other activity has to
// answer. Ruth, who designed that: "noone knows that you can say rest day in
// chat, even i didn't really know or remember." So this is not a new
// capability, it is the same one with a way in that can be seen.
//
// AND IT COUNTS, which is the point of logging it. "rest day" is in the
// weighting table as 100% recovery, so coverageColumns fills the six cover_*
// values and the Health Flower sees it. Before 21 October a row written from
// the phone carried none of them and would have counted for nothing - see
// coverage-columns.ts for the count that found that.

/** The activity name a rest day is stored under. In the weighting table. */
export const REST_DAY = 'rest day';

export type RestResult = 'logged' | 'already' | 'failed';

/** Local midnight, as the start of the day this would belong to. */
function dayBounds(now = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Log today as a rest day, unless something is already logged for today.
 *
 * ONE A DAY, GUARDED HERE. The screen hides the offer once anything is logged,
 * and that is a courtesy rather than a guarantee: two taps in quick succession,
 * a stale screen, a second device. The rule this project keeps relearning is
 * that a guard belongs where the row is created.
 *
 * AND ANY ACTIVITY AT ALL BLOCKS IT, not just another rest day. A day she went
 * to ballet is not a rest day, and a second row saying it was would quietly
 * add a hundred points of recovery to her week.
 */
export async function logRestDay(now = new Date()): Promise<RestResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 'failed';

  const { from, to } = dayBounds(now);
  const { data: existing, error: readError } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('user_id', user.id)
    .gte('happened_at', from)
    .lt('happened_at', to)
    .limit(1);
  // A READ THAT FAILED IS NOT AN EMPTY DAY. Treating it as one is how a
  // duplicate gets written on a bad connection.
  if (readError) return 'failed';
  if (existing && existing.length > 0) return 'already';

  // MIDDAY, like every other row this app writes without a clock time. A rest
  // day has no hour, and midnight would put it on the edge of two days in any
  // timezone arithmetic that follows.
  const at = new Date(now);
  at.setHours(12, 0, 0, 0);

  const { error } = await supabase.from('activity_logs').insert({
    user_id: user.id,
    activity_type: REST_DAY,
    // NO DURATION, AND THAT IS CORRECT. The chat path makes the same exception
    // in as many words: "a rest day burns nothing to guess at". Every other
    // activity is refused without one.
    duration_min: null,
    happened_at: at.toISOString(),
    source: 'rest day',
    ...coverageColumns(REST_DAY),
  });
  return error ? 'failed' : 'logged';
}
