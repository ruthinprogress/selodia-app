import type { CalendarEvent } from '@/lib/calendar-types';

// THE DIARY'S ARITHMETIC, IN A FILE A CHECK CAN ACTUALLY LOAD.
//
// Split out for the same reason week-reminder-time.ts was, yesterday: calendar.ts
// imports supabase, supabase reaches react-native, and react-native cannot be
// parsed by plain node - so a check that imported it died on a Flow type
// annotation rather than on anything to do with dates.
//
// Everything here is pure. The rules it encodes are the ones most likely to go
// wrong silently and least likely to be noticed: a date behind today, an hour
// invented from nothing, a reminder scheduled into the past, a cancelled one
// scheduled anyway. All four are only discovered by missing the appointment.

/** Today as YYYY-MM-DD in local time, which is the day she is living in. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The moment a one-off reminder should arrive, or null if it cannot. */
export function reminderMoment(e: CalendarEvent, now: Date = new Date()): Date | null {
  if (!e.remind_at || e.reminder_cancelled_at) return null;
  const [y, m, d] = e.event_date.split('-').map(Number);
  const [hh, mm] = e.remind_at.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => !Number.isFinite(n))) return null;
  const at = new Date(y, m - 1, d, hh, mm, 0, 0);
  const offset = e.remind_offset_minutes ?? 0;
  if (offset > 0) at.setMinutes(at.getMinutes() - offset);
  // A MOMENT THAT HAS PASSED IS NOT A REMINDER. Scheduling one in the past
  // either fires immediately - a notification about an appointment that has
  // already started - or is silently dropped by the OS. Neither is what
  // anybody asked for, so it is refused here where that can be said.
  return at.getTime() > now.getTime() ? at : null;
}

/**
 * How a date reads to somebody looking at their week.
 *
 * NO "IN 3 DAYS", which would have to be recomputed to stay true and is wrong
 * the moment the screen is left open overnight. A weekday and a date are both
 * still correct tomorrow.
 */
export function eventDateLabel(eventDate: string, today: string = todayKey()): string {
  const [y, m, d] = eventDate.split('-').map(Number);
  const at = new Date(y, m - 1, d, 12);
  const [ty, tm, td] = today.split('-').map(Number);
  const todayAt = new Date(ty, tm - 1, td, 12);
  const days = Math.round((at.getTime() - todayAt.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  const weekday = at.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  // Within the week ahead, the weekday is what she is navigating by. Beyond it,
  // "Tuesday" is ambiguous and the date is the useful half.
  return days < 7 ? `${weekday} ${date}` : date;
}

/** 'HH:MM:SS' -> '14:30'. Null stays null: a day with no hour says nothing. */
export function eventTimeLabel(eventTime: string | null): string | null {
  if (!eventTime) return null;
  const [hh, mm] = eventTime.split(':');
  return hh && mm ? `${hh}:${mm}` : null;
}
