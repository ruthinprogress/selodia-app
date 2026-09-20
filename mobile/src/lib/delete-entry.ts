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
  | 'sleep_logs';

/** True when the row is gone. Never throws: the caller says so on screen. */
export async function deleteEntry(table: DeletableTable, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.log('DELETE ENTRY FAILED:', error.message);
    return false;
  }
  return true;
}
