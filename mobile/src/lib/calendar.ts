import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/calendar-time';

// One place to import the diary from; the arithmetic lives next door so checks
// can load it without dragging react-native in. See calendar-time.ts.
export { todayKey, reminderMoment, eventDateLabel, eventTimeLabel } from '@/lib/calendar-time';
export type { CalendarEvent } from '@/lib/calendar-types';
import type { CalendarEvent } from '@/lib/calendar-types';

// HER DIARY: ONE-OFF, DATED, AND NOT THE WEEK.
//
// Ruth, 18 October 2026: "Week is a template of your week... It's not a
// calendar. It's not for one-off appointments. If it was a one-off appointment,
// they would ask in chat to add something to their calendar." Then: "we need to
// build calendar also then."
//
// user_week holds day NAMES and recurs forever. This holds dates and happens
// once. The two never mix, which is why they are two tables and two screens.


/**
 * What is still to come, soonest first.
 *
 * FROM TODAY, NOT FROM NOW. An appointment at 2pm is still today's appointment
 * at 4pm, and dropping it off the list the moment it passes would be the app
 * deciding she has been - which it has no way of knowing and no business
 * assuming. It leaves the list when the day does.
 */
export async function loadUpcoming(limit = 20): Promise<CalendarEvent[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, event_date, event_time, place, what_to_bring, notes, remind_at, remind_offset_minutes, reminder_cancelled_at')
    .eq('user_id', user.id)
    .gte('event_date', todayKey())
    .order('event_date', { ascending: true })
    // NULLS FIRST on the time, deliberately. A thing with no hour is a thing
    // about the whole day, so it belongs at the top of that day rather than
    // sorted as though it were at midnight or at the end.
    .order('event_time', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error || !data) return [];
  return data as CalendarEvent[];
}

/** Everything with a live reminder still to come, for the phone to schedule. */
export async function loadCalendarReminders(): Promise<CalendarEvent[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, event_date, event_time, place, what_to_bring, notes, remind_at, remind_offset_minutes, reminder_cancelled_at')
    .eq('user_id', user.id)
    .gte('event_date', todayKey())
    .not('remind_at', 'is', null)
    .is('reminder_cancelled_at', null);
  if (error || !data) return [];
  return data as CalendarEvent[];
}

/**
 * Take it out of the diary for good.
 *
 * A REAL DELETE, unlike a week card. A week card taken off its days falls into
 * Anytime because it is a thing she does; an appointment has nowhere to fall to
 * - a date is the only place it could sit. Cancelled or written down wrongly,
 * it should go.
 */
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Switch its reminder off, from the notification or from the diary. */
export async function cancelEventReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .update({ reminder_cancelled_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

