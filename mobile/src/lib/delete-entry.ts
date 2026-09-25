import { supabase } from '@/lib/supabase';

// REMOVING ONE ENTRY - the delete itself, away from any particular control, so
// the row control and the card control cannot drift apart (2026-09-18).
//
// WHY IT IS ALLOWED AT ALL, given "permanent, never deleted". That rule is about
// the app not quietly discarding somebody's history, not about trapping a
// mistake in it. A meal logged twice, a weight typed wrong, a run that never
// happened: leaving those in is not honesty, it is a wrong record nobody can
// correct. Chat could already delete an entry by being asked; this is the same
// power where the entry is.
//
// RLS scopes the delete to the signed-in person's own row.

export type DeletableTable =
  | 'food_logs'
  | 'activity_logs'
  | 'body_measurements'
  | 'personal_metrics'
  | 'hydration_logs'
  | 'sleep_logs'
  // PLANS AND ANYTHING ELSE KEPT IN THE ALMANAC (2026-09-25). Until today
  // nothing anywhere in this codebase deleted one: not a control, not the
  // chat pipeline, not an admin path. Ruth asked Selodía to remove a duplicate
  // workout, was told it was done, and both copies are still there - because
  // there was no mechanism for it to use and nothing stopped it saying yes.
  //
  // SAFE AS A PLAIN ROW DELETE, which is worth stating because a plan is
  // referenced by history. workout_completion_log.plan_id and
  // workout_weight_log.plan_id are both ON DELETE SET NULL, so the record of
  // what somebody actually did survives and only the link to the deleted plan
  // is cleared. Checked against the live schema rather than assumed.
  | 'almanac_entries';

/** True when the row is gone. Never throws: the caller says so on screen. */
export async function deleteEntry(table: DeletableTable, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.log('DELETE ENTRY FAILED:', error.message);
    return false;
  }
  return true;
}
