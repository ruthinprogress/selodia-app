// HOW A GOAL IS SHOWN, WITHOUT CHANGING WHAT SHE WROTE.
//
// Ruth, 29 September: "Capitalise the first letter of every goal when
// displayed, without changing what I wrote."
//
// Both halves of that sentence matter. Her goals arrive from chat in the middle
// of a conversation, so they are stored as she said them - "reduce body fat and
// get back into old jeans" - and a lower-case sentence at the top of a screen
// reads as a fragment rather than as a goal. But the stored text is HERS, and a
// screen that quietly rewrote it would mean the words in the database and the
// words on the phone were different, which is the start of not being able to
// trust either.
//
// So: the first character is upper-cased at render time and nothing else is
// touched. Not the rest of the sentence, not the punctuation, not "40kg",
// nothing.

/**
 * The goal as it should appear on screen.
 *
 * LEAVES AN ALREADY-CAPITAL LETTER ALONE, and leaves anything that does not
 * start with a letter entirely alone - a goal starting with a number or a
 * quotation mark is hers to start that way.
 */
export function displayGoal(label: string): string {
  const text = (label ?? '').trim();
  if (!text) return text;
  const first = text[0];
  // toUpperCase on a non-letter returns it unchanged, so this is safe without
  // testing for one - but the early return keeps the intent readable.
  return first.toUpperCase() + text.slice(1);
}

/** "26 August 2026". Built by hand, for the reason week.ts is: Hermes on
 * Android ships a variable ICU build, so toLocaleDateString can return a
 * different string on a different phone. */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function goalDate(setOn: string | null): string | null {
  if (!setOn) return null;
  // A plain date column comes back as YYYY-MM-DD. Parsed by parts rather than
  // by Date(), which would apply a timezone and can move the day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(setOn);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1];
  if (!month) return null;
  return `${Number(d)} ${month} ${y}`;
}
