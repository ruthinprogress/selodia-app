import { supabase } from '@/lib/supabase';

// MOVING AN ACTIVITY TO A DAY - one write, wherever the move came from.
//
// There are now THREE ways to move a card: dragging it, holding it and picking
// from a list, and "Move to…" inside the tap sheet. Ruth asked for all three,
// and deliberately: "Keep it permanently alongside drag; it's also the
// accessible route, since screen reader users can't drag."
//
// Three entry points is three chances to forget something, and there are two
// things here that are easy to forget and silent when you do:
//
//   days_chosen_at   Under "Let me lead" a card has no day until SHE gives it
//                    one. A move that writes `days` without this stamp puts the
//                    card on a day the week will then refuse to show, which
//                    looks exactly like the move not working.
//   week_drag_used_at  The hint goes away once she has moved something. A move
//                    that skips it leaves the hint on screen forever.
//
// So the write lives here and every path calls it. A guard belongs at the
// write, not at each of the three reads.

/** Where a card can go. An empty list means Anytime this week. */
export async function moveToDays(rowId: string, days: string[]): Promise<void> {
  const chosenAt = new Date().toISOString();
  const { error } = await supabase
    .from('user_week')
    .update({ days, days_chosen_at: chosenAt })
    .eq('id', rowId);
  if (error) throw new Error(error.message);
  await markMoveUsed();
}

/**
 * The hint is shown until she has moved something and then never again. Best
 * effort: a failure here must never fail the move itself, because the move is
 * the thing she asked for and the hint is only furniture.
 */
export async function markMoveUsed(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profile')
      .update({ week_drag_used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('week_drag_used_at', null);
  } catch {
    // Deliberately silent. See above.
  }
}

/** Adding a day keeps the days it already had; "also on Thursday" is real. */
export function withDay(days: string[] | null, day: string): string[] {
  return [...new Set([...(days ?? []), day])];
}

/** Tapping a day it is already on takes it off that day. */
export function toggleDay(days: string[] | null, day: string): string[] {
  const current = days ?? [];
  return current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
}

/**
 * TAKE SOMETHING OUT OF HER WEEK.
 *
 * Ruth, 1 October 2026: "Plans - Week - no way to delete a card." There was
 * not. A card could be moved between days, logged, and dragged, and the only
 * delete against user_week in the whole app was the one onboarding uses to wipe
 * the table before writing a fresh set.
 *
 * NOT CALLED DELETE, ON THE SCREEN OR HERE. A week card is a plan - "Gym, 1.5
 * hrs" - not a record of something that happened. Removing it changes what she
 * intends to do, destroys no history, and is undone by adding it back. "Delete"
 * would borrow the weight of the food and measurement deletes, which really are
 * irreversible, and that weight is what makes somebody hesitate over a thing
 * that does not deserve hesitation.
 *
 * THE LOGS IT PRODUCED STAY. Sessions already logged against this activity live
 * in activity_logs and are untouched: she did those, and taking yoga out of her
 * week next month cannot mean she never went.
 */
export async function removeFromWeek(rowId: string): Promise<void> {
  const { error } = await supabase.from('user_week').delete().eq('id', rowId);
  if (error) throw new Error(error.message);
}
