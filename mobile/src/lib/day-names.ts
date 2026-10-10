// THE DAY, AS A DATE AND AS A WORD.
//
// Lifted out of the Cycle screen on 10 October 2026 when that screen split in
// two and both halves needed the same three functions. Copying them would have
// been three lines; it would also have been two definitions of "yesterday".
//
// THE CASING IS THE POINT OF MOVING IT. Every call site used to lowercase the
// result - `Started ${human(day).toLowerCase()}`, `Save ${human(day)
// .toLowerCase()}` - which put "Started sat 1 aug" and "Save sat 1 aug" on her
// phone. That was done to make the date read as part of a sentence, and it
// instead read as a typo, because a weekday and a month are proper nouns in
// English whatever precedes them. The function returns the form that is correct
// everywhere, and nothing downcases it.

/** Today, as YYYY-MM-DD in local time. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A day, moved by whole days. Noon UTC so a daylight-saving shift cannot land on the wrong date. */
export function shift(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/** What to call a day on screen: Today, Yesterday, or "Sat 1 Aug". */
export function human(day: string): string {
  if (day === today()) return 'Today';
  if (day === shift(today(), -1)) return 'Yesterday';
  const d = new Date(`${day}T12:00:00Z`);
  return isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * The same, lowered to sit mid-sentence - but only the words that may be.
 *
 * "Today" and "Yesterday" are ordinary nouns and read better lowercase after
 * another word ("saved today"). A weekday and a month never may. This exists so
 * that a call site wanting a mid-sentence date has something correct to call,
 * rather than reaching for .toLowerCase() and producing "sat 1 aug".
 */
export function midSentence(day: string): string {
  const name = human(day);
  return name === 'Today' || name === 'Yesterday' ? name.toLowerCase() : name;
}
