// WHAT IS IN HER DIARY, SHOWN TO THE MODEL THAT WRITES INTO IT.
//
// Selodía's own chat, 21 October 2026, after failing twice to remove a
// duplicate entry: "I've been guessing at what the entries are called, and
// that's why this keeps missing. Could you type the words exactly as they
// appear... With the real wording I can try again."
//
// IT WAS NOT GUESSING OUT OF CARELESSNESS. calendar_events was written by the
// chat and never read back into the record, so the model could create a diary
// entry and could be asked to cancel one - by a title match, against a list it
// had never been shown. Asking somebody to delete a row by name while refusing
// to tell them the names is not a thing that can be done reliably; the chat
// then had to ask Ruth to read her own screen back to it.
//
// THE SAME BLINDNESS MADE THE DUPLICATES. Three copies of "contact GP if ear
// ringing persists" on 27 October, because each turn that tried again had no
// way to see the two already sitting there. The write now refuses an exact
// repeat as well - see the route - but a model that can SEE the diary would
// not have asked for the second one.
//
// IT IS SMALL ON PURPOSE. A diary is a handful of rows, and this is the whole
// of what is still to come rather than a window - somebody who has one thing
// booked in March wants to be told about it in January.

export type DiaryRow = {
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  place?: string | null;
};

/** "Tuesday 27 October", which is how the app says a date everywhere else. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/**
 * The diary, for the record. Null when it is empty, so an empty diary costs
 * nothing rather than adding a line saying there is nothing.
 *
 * THE TITLE IS QUOTED EXACTLY, because the only operation that needs this
 * block is a match against it. A tidied or retyped title here would reproduce
 * the bug this exists to fix.
 */
export function diaryBlock(rows: DiaryRow[]): string | null {
  const lines = rows
    .filter((r) => (r.title ?? '').trim() && (r.event_date ?? '').trim())
    .map((r) => {
      const when = longDate(r.event_date as string);
      const at = r.event_time ? ` at ${r.event_time.slice(0, 5)}` : '';
      const place = r.place ? `, ${r.place}` : '';
      return `- "${(r.title as string).trim()}" on ${when}${at}${place}`;
    });
  if (lines.length === 0) return null;
  return [
    "WHAT IS ALREADY IN THEIR DIARY, soonest first. These are the one-off dated things on their Coming up list.",
    ...lines,
    'To take one out, use calendarTitle with the words EXACTLY as they are quoted above - that is what it is matched against.',
    'And do not add one that is already here: if they ask for something this list already holds on that date, say it is already in their diary rather than making a second copy.',
  ].join('\n');
}
