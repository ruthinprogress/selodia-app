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

/**
 * PUT SOMETHING NEW IN HER WEEK, from the week screen itself.
 *
 * Ruth, 1 October 2026: "I start a new class, like french class, and I want to
 * see it in the week because it blocks that evening availability for movement.
 * I tap plus and at the bottom of pre-existing activities I do, I can Text add."
 *
 * UNTIL NOW HER WEEK WAS FIXED AT SETUP. The only insert into user_week in the
 * whole app was onboarding's. The day's "+" could put an EXISTING activity on
 * another day and otherwise said "Something else — tell chat", and chat had no
 * route either. So a week was whatever she picked from a list of eleven on one
 * screen, for good. Adding a remove that same morning made it a one-way door.
 *
 * NOT EVERYTHING IN A WEEK IS EXERCISE, which is the whole point of her
 * example. A French class earns its place by taking the evening, not by being
 * training. Nothing here checks what the thing is, and nothing should.
 *
 * DAYS_CHOSEN_AT IS STAMPED because she typed this onto a named day. Under "Let
 * me lead" a card with days and no stamp is hidden from the week, so the row
 * would be written and then not appear - the exact shape of the bug that lost a
 * morning on 1 October.
 *
 * NO CADENCE, NO PURPOSE. Both are left null for the reason onboarding leaves
 * purpose null: she typed a name and a day, and "1x/week" would be the app
 * deciding how often she goes. Chat can fill either in later from an actual
 * conversation.
 */
export async function addToWeek(
  activity: string,
  days: string[],
  timeOfDay?: string | null
): Promise<void> {
  const name = activity.trim();
  if (!name) throw new Error('Needs a name.');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  // LAST IN HER WEEK, not first. sort_order decides the Anytime order, and a new
  // thing arriving at the top would reshuffle a list she has been reading for a
  // fortnight.
  const { data: last } = await supabase
    .from('user_week')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder =
    Array.isArray(last) && typeof last[0]?.sort_order === 'number' ? last[0].sort_order + 1 : 0;

  const { error } = await supabase.from('user_week').insert({
    user_id: user.id,
    activity: name,
    days,
    days_chosen_at: days.length > 0 ? new Date().toISOString() : null,
    time_of_day: timeOfDay?.trim() ? timeOfDay.trim() : null,
    cadence: null,
    purpose: null,
    sort_order: nextOrder,
  });
  if (error) throw new Error(error.message);
  await markMoveUsed();
}
