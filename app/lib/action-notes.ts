import type { CalendarResult } from './calendar-event';

// WHAT HAPPENED AFTER THE APP ACTED, IN WORDS THE REPLY CAN READ.
//
// Selodía's own chat, asked on 20 October 2026 what makes its job harder, and
// this was the first of three things it named:
//
//   "I can't see what happened after I act. I asked for the calendar entry and
//    the reminder, but couldn't tell whether they worked, so I kept passing the
//    failures back to you."
//
// IT WAS RIGHT, AND THE CODE SAID SO. Both writes ended the same way:
//
//   if (error) console.log('CALENDAR INSERT FAILED:', error.message);
//   else calendarResult = { action: 'added', ... };
//
// A failure went to the server log and nowhere else, and even a SUCCESS only
// reached the HTTP response - neither one was ever added to didLines, which is
// the block the reply is written from. So the model asked for a diary entry,
// something happened, and it was told nothing either way. It then had to guess,
// and a model that guesses about a write is the exact fault this app has spent
// a month building guards against.
//
// THE PRECEDENT IS ALREADY HERE. planNote, saveNote, meNote, weekNote,
// ruleRemovalNote and honestyNote all exist for this reason, and the plan
// removal says it plainly: "The app says what happened, always - including 'I
// could not find it' and 'there are two and they differ, which did you mean'.
// The model is told not to claim anything, and this is the half of that
// instruction that does not depend on the model obeying it." The diary and the
// reminder were simply never given their half.
//
// THESE ARE FACTS, NOT SCRIPTS. Each line says what occurred and stops. It does
// not tell the reply how to feel about it or what to offer next, because the
// model is better at that than a template is, and because an instruction here
// would be a second voice arguing with the prompt.

export type ReminderResult =
  | { action: 'created'; label: string; atTime: string; weekday: number | null }
  | { action: 'cancelled'; label: string; count: number }
  | { action: 'failed'; label: string; doing: 'create' | 'cancel' };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * What became of a diary entry this turn, or null if the turn touched none.
 *
 * A REFUSAL IS AN OUTCOME TOO. checkCalendarEvent already declines a date in
 * the past or a missing title, and that reason has to travel: "I put it in"
 * and "I would not put it in because it is already gone" are different things
 * to be told, and only one of them means she should check her diary.
 */
export function calendarNote(r: CalendarResult | null): string | null {
  if (!r) return null;
  switch (r.action) {
    case 'added': {
      const when = r.eventTime ? `${r.eventDate} at ${r.eventTime}` : r.eventDate;
      // THE DROPPED REMINDER IS NAMED. Asking for one on an all-day entry is
      // reasonable and gets silently ignored, so without this she is told the
      // reminder is set and nothing ever arrives.
      const dropped = r.reminderDropped
        ? ' The reminder they asked for was not set, because the entry has no time on it.'
        : '';
      // AND WHAT TRAVELLED WITH IT. The detail was gathered from this
      // conversation and her records, so the turn that gathered it is exactly
      // the turn that will be asked "did you put the number in?". Quoted as
      // stored, because a paraphrase of a phone number is a wrong one.
      const carried = r.notes
        ? ` Saved with it, so it arrives when the reminder does: "${r.notes}".`
        : '';
      return `diary entry written: "${r.title}" on ${when}.${dropped}${carried}`;
    }
    case 'cancelled':
      return r.count === 0
        ? `nothing in their diary matched "${r.title}", so nothing was cancelled.`
        : `taken out of their diary: ${r.count} ${r.count === 1 ? 'entry' : 'entries'} matching "${r.title}".`;
    case 'refused':
      return `the diary entry was NOT written, because the date is ${r.because}${
        r.detail ? ` (${r.detail})` : ''
      }.`;
    case 'failed':
      // SAID IN THE PLAINEST POSSIBLE TERMS, because this is the line that
      // stops a reply claiming a write that did not happen.
      return 'the diary entry FAILED to save. Nothing is in their diary. Do not say it is.';
    case 'duplicate':
      // NEITHER A SUCCESS NOR A FAILURE, and it has to read as neither. "It
      // saved" sends her looking for a second copy; "it failed" is what
      // produced the three copies in the first place.
      return (
        `"${r.title}" is ALREADY in their diary on ${r.eventDate}, so no second copy was made. ` +
        'Tell them it is already there rather than that it was added or that it failed.'
      );
  }
}

/** The same, for a reminder. */
export function reminderNote(r: ReminderResult | null): string | null {
  if (!r) return null;
  switch (r.action) {
    case 'created': {
      const repeat = r.weekday == null ? 'every day' : `every ${DAYS[r.weekday]}`;
      return `reminder set: "${r.label}" at ${r.atTime}, ${repeat}.`;
    }
    case 'cancelled':
      return r.count === 0
        ? `no active reminder matched "${r.label}", so nothing was stopped.`
        : `reminders stopped: ${r.count} matching "${r.label}".`;
    case 'failed':
      return r.doing === 'create'
        ? `the reminder FAILED to save. Nothing will arrive. Do not say it is set.`
        : `the reminder could NOT be stopped. It is still active. Do not say it is off.`;
  }
}
