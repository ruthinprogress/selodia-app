import { correctionDayRange } from './log-correction';

// THE DAY A LOG BELONGS TO, WHEN SHE NAMED IT A FEW MESSAGES AGO.
//
// Ruth, 12 October 2026: "I go to catch up on my food logs and log to add more
// into Friday and it logs it for today." And then: "it didn't save to Friday."
//
// She had said she was catching up Friday, then sent "I had a pizza for dinner
// with salami - homemade pizza". The reply said "a good Friday dinner". The row
// said Monday 12 October. The model understood the day perfectly well; it just
// had nowhere to put it. logText is "stripped of everything that is not the
// food", so the day was stripped too, and the food parser only ever sees
// logText - which named no day - so it logged today.
//
// So the day is its own field, logDate, and this turns it into a moment the
// writers can use. A day in the message itself still wins, because the parser
// reads it per entry: "Mon 7th pizza, Tues 8th burger" in one catch-up stays
// two days. logDate is the default for entries that name none.
//
// CHECKED HERE, NOT TRUSTED. Never a future day, and never more than a month
// back: a mistaken date on a meal is a quiet lie in every weekly figure, so a
// date this cannot stand behind is dropped and the entry is logged as today -
// which is at least the day she can see it on.

/** How far back a named day is believed. A month covers any real catch-up. */
export const OLDEST_DAY_BACK = 31;

/** Today in London, as yyyy-mm-dd. */
export function londonToday(now: Date = new Date(), timeZone = 'Europe/London'): string {
  return now.toLocaleDateString('en-CA', { timeZone });
}

/**
 * The moment to stamp an entry for the named day, or undefined to leave it as
 * today.
 *
 * THE TIME IS NOW'S TIME OF DAY, IN LONDON, ON THAT DAY. Nobody catching up on
 * Monday can say what time on Friday they ate, so the time is borrowed - but it
 * is borrowed in London time and placed inside that London day, so an evening
 * entry in summer cannot slip an hour into the next day the way a bare UTC time
 * would.
 */
export function logDayHappenedAt(
  logDate: unknown,
  now: Date = new Date(),
  timeZone = 'Europe/London'
): string | undefined {
  if (typeof logDate !== 'string') return undefined;
  const day = logDate.trim();
  const range = correctionDayRange(day, timeZone);
  if (!range) return undefined;

  const today = londonToday(now, timeZone);
  if (day === today) return undefined;
  if (day > today) return undefined;

  const todayRange = correctionDayRange(today, timeZone);
  if (!todayRange) return undefined;
  const daysBack = Math.round((Date.parse(todayRange.from) - Date.parse(range.from)) / 86_400_000);
  if (daysBack > OLDEST_DAY_BACK) return undefined;

  // How far into today London is, carried onto the named day.
  const intoToday = Math.max(0, now.getTime() - Date.parse(todayRange.from));
  const dayLength = Date.parse(range.to) - Date.parse(range.from);
  const at = Date.parse(range.from) + Math.min(intoToday, dayLength - 1000);
  return new Date(at).toISOString();
}
