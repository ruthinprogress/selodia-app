// THE DIARY: ONE-OFF, DATED, AND NOT THE WEEK.
//
// Ruth, 18 October 2026, drawing the line between the two herself:
//
//   "Week is a template of your week, it's not a real week... It's not a
//    calendar. It's not for one-off appointments. If it was a one-off
//    appointment, they would ask in chat to add something to their calendar
//    (that's build already right?)"
//
// It was not. "we need to build calendar also then."
//
// WHAT THE HARD PART IS, and it is not the table. Chat has to turn "my physio
// is on Tuesday at 3" into a date, and the prompt already carries a rule for
// turning named days into dates that is exactly backwards for this:
//
//   "A weekday with no other detail means the most recent one that has already
//    happened, never one still to come."
//
// That rule is right, and it is right because almost everything else chat does
// is a LOG - somebody catching up on yesterday's lunch or the day their period
// started. A diary is the one thing in this app that looks forward. So the
// field description says the opposite in as many words, and this file is the
// guard behind it, because a prompt rule that contradicts another prompt rule
// is a coin toss and the losing side files a hospital appointment in the past.
//
// A GUARD BELONGS AT THE WRITE. Her standing rule, learned the hard way: never
// ask the model not to do a thing twice, enforce it where the row is created.

/** A date somebody gave, as YYYY-MM-DD, or null if it was not one. */
export function validEventDate(value: string | undefined): string | null {
  const s = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  // Real, not just well-shaped: 2026-02-31 passes the pattern. Parsed as UTC
  // noon and read back, so no timezone can shift the day.
  const [y, m, d] = s.split('-').map(Number);
  const asDate = new Date(Date.UTC(y, m - 1, d, 12));
  if (Number.isNaN(asDate.getTime())) return null;
  if (asDate.getUTCFullYear() !== y || asDate.getUTCMonth() !== m - 1 || asDate.getUTCDate() !== d) {
    return null;
  }
  return s;
}

/** A clock time as HH:MM, or null. Null is a legitimate answer, not a failure. */
export function validEventTime(value: string | undefined): string | null {
  const s = (value ?? '').trim();
  if (!s) return null;
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s) ? s : null;
}

/** Whole days from today to the date, negative for the past. */
export function daysAhead(eventDate: string, todayKey: string): number {
  const at = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(eventDate) - at(todayKey)) / 86400000);
}

export type CalendarRow = {
  title: string;
  event_date: string;
  event_time: string | null;
  place: string | null;
  what_to_bring: string | null;
  remind_at: string | null;
  remind_offset_minutes: number | null;
};

export type CalendarRefusal =
  | { ok: false; because: 'no title' }
  | { ok: false; because: 'no date' }
  | { ok: false; because: 'in the past'; eventDate: string; daysBehind: number };

export type CalendarCheck = { ok: true; row: CalendarRow; reminderDropped: boolean } | CalendarRefusal;

/**
 * Turn what chat produced into a row, or refuse it with a reason the app can
 * say out loud.
 *
 * REFUSING IS THE POINT. Every other path here would be a silent guess, and a
 * guess about a date is one somebody only finds out about by missing the thing.
 */
export function checkCalendarEvent(
  input: {
    title?: string;
    date?: string;
    time?: string;
    place?: string;
    bring?: string;
    remindMinutesBefore?: number;
  },
  todayKey: string
): CalendarCheck {
  const title = (input.title ?? '').trim();
  if (!title) return { ok: false, because: 'no title' };

  const eventDate = validEventDate(input.date);
  if (!eventDate) return { ok: false, because: 'no date' };

  // THE BACKWARDS-WEEKDAY GUARD. "Tuesday" resolved by the logging rule lands
  // up to six days behind, and an appointment in the past is not a thing
  // anybody asks for. YESTERDAY IS ALLOWED, because somebody writing up an
  // appointment they went to yesterday is real and harmless; anything older is
  // the model having applied the wrong rule.
  const ahead = daysAhead(eventDate, todayKey);
  if (ahead < -1) {
    return { ok: false, because: 'in the past', eventDate, daysBehind: -ahead };
  }

  const eventTime = validEventTime(input.time);

  // A REMINDER NEEDS SOMETHING TO BE BEFORE. "Remind me an hour before" is
  // meaningless against a date with no hour, and the honest answer is to keep
  // the appointment and say the reminder could not be set - not to invent a 9am
  // so the offset has something to subtract from.
  const wantsReminder =
    typeof input.remindMinutesBefore === 'number' && Number.isFinite(input.remindMinutesBefore);
  const canRemind = wantsReminder && eventTime != null;

  return {
    ok: true,
    reminderDropped: wantsReminder && !canRemind,
    row: {
      title,
      event_date: eventDate,
      event_time: eventTime,
      place: (input.place ?? '').trim() || null,
      what_to_bring: (input.bring ?? '').trim() || null,
      // Stored the same way a week card stores it, so fireTime() does the
      // subtracting for both and the arithmetic is tested once.
      remind_at: canRemind ? eventTime : null,
      remind_offset_minutes: canRemind
        ? Math.max(0, Math.round(input.remindMinutesBefore as number))
        : null,
    },
  };
}

/** What the app says it did. The model is never the one to claim it. */
export type CalendarResult =
  | {
      action: 'added';
      title: string;
      eventDate: string;
      eventTime: string | null;
      reminderDropped: boolean;
    }
  | { action: 'refused'; because: CalendarRefusal['because']; detail?: string }
  | { action: 'cancelled'; title: string; count: number };
