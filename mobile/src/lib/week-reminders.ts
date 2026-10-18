import { supabase } from '@/lib/supabase';
// Re-exported so callers have one place to import from, while the arithmetic
// stays in a file a check script can actually load. See week-reminder-time.ts.
export { fireTime, weekdayNumber } from '@/lib/week-reminder-time';

// THE REMINDER THAT COMES FROM SOMETHING IN YOUR WEEK.
//
// Ruth, 18 October 2026, after Lynda and Carrie at the climbing gym both said
// what they liked about another training app was that "it told them what to do
// and when" - and one of them had switched the notifications on.
//
// Selodia had progressions, plans and reminders, and no wire between them.
// There were exactly two kinds of reminder: the app's own daily prompt to log,
// and anything somebody asked for in their own words. Neither was derived from
// a plan, so nothing ever said "today is the wall walks". This is that wire.
//
// WHY IT IS NOT READ FROM time_of_day. That column is prose on purpose - "7pm",
// "evening", "after the school run" and "before work" are all answers somebody
// might give and only one is a clock time, so week-view.tsx says plainly that
// nothing sorts or alarms on it. A reminder needs a real time, so it has its
// own column that is always one.

export type WeekReminder = {
  id: string;
  activity: string;
  /** Day names, as stored - the same ones the card sits on. */
  days: string[];
  /** 'HH:MM:SS' from Postgres `time`. */
  remind_at: string;
  remind_offset_minutes: number | null;
};

/**
 * Everything in somebody's week that wants a weekly nudge.
 *
 * Cancelled ones are excluded in SQL rather than filtered here, because a
 * reminder somebody switched off must never come back by accident and the
 * narrowest place to guarantee that is the query.
 */
export async function loadWeekReminders(): Promise<WeekReminder[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_week')
    .select('id, activity, days, remind_at, remind_offset_minutes')
    .eq('user_id', user.id)
    .not('remind_at', 'is', null)
    .is('reminder_cancelled_at', null);
  if (error || !data) return [];

  // A card with no days sits in Anytime, and Anytime has no day to fire on.
  // Dropped here rather than in SQL because an empty array is awkward to test
  // for in PostgREST and this is a handful of rows.
  return data.filter((r) => Array.isArray(r.days) && r.days.length > 0) as WeekReminder[];
}

/**
 * Switch a reminder off for good, from the notification itself.
 *
 * WRITES TO STORAGE, NOT JUST THE SCHEDULE, and that is the whole trap.
 * restoreReminders() re-applies everything from stored state on every launch,
 * so cancelling the pending alarm alone brings the reminder back the next time
 * the app opens - and it looks exactly like the off switch is broken.
 *
 * A TIMESTAMP RATHER THAN CLEARING remind_at, so the app can tell "never wanted
 * one" from "had one and stopped it" and never offers the same person the same
 * reminder again.
 */
export async function cancelWeekReminder(rowId: string): Promise<void> {
  await supabase
    .from('user_week')
    .update({ reminder_cancelled_at: new Date().toISOString() })
    .eq('id', rowId);
}

/** Set or change the reminder on a week card. */
export async function setWeekReminder(
  rowId: string,
  remindAt: string | null,
  offsetMinutes: number | null
): Promise<void> {
  await supabase
    .from('user_week')
    .update({
      remind_at: remindAt,
      remind_offset_minutes: offsetMinutes,
      // Setting one again un-cancels it: she has just asked for it, which is a
      // newer answer than the one she gave when she switched it off.
      reminder_cancelled_at: null,
    })
    .eq('id', rowId);
}
