// THE WEEK AS A WEEK: which day a planned activity sits on, and what to do
// when the plan disagrees with itself.
//
// Ruth's design, 29 September 2026. My Week used to be a flat cadence list -
// "Gym, 1x/week, ~60 min" - which is what the specification asked for and what
// her own earlier reference drew. The new design puts those activities on named
// days, with an "Anytime this week" shelf underneath for the ones that have no
// fixed day.
//
// THE DAY IS RECURRING, THE DATE IS NOT. `user_week.days` holds day NAMES, so
// "Gym on Monday and Thursday" stays true next week without anything being
// rewritten. The dates on screen are this week's, worked out here.
//
// NOTHING HERE KNOWS ABOUT COMPLETION. A tick beside a card means "this was
// logged", read from activity_logs, and there is still no completion column on
// user_week. The distinction matters: the app can say what happened, and it
// must never hold an opinion about what did not.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** The day key for a date. getDay() is Sunday-first; the week here is not. */
export function dayKeyOf(d: Date): DayKey {
  return DAY_KEYS[(d.getDay() + 6) % 7];
}

/** "22 Sept". Built by hand for the reason week.ts is: Hermes on Android ships
 * a variable ICU build, so the same toLocaleDateString can differ per phone. */
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

export function shortDate(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

// ---------------------------------------------------------------- cadence

/**
 * How many times a week a cadence says, or null when it does not say.
 *
 * DELIBERATELY NARROW. It understands the shapes the app itself writes -
 * "1x/week", "2x/week", "Daily", "A few times a week" - and answers null to
 * anything else rather than guessing. A wrong number here would raise a
 * disagreement that does not exist, and the whole point of the question below
 * is that it is only asked when there genuinely is one.
 */
export function timesPerWeek(cadence: string | null): number | null {
  if (!cadence) return null;
  const c = cadence.trim().toLowerCase();

  if (/^daily\b|every day|most days/.test(c)) return 7;
  // "when possible", "now and then", "a few times a week" - all real answers,
  // and none of them is a number. A range is not a disagreement.
  if (/when possible|now and then|a few times|when i can|occasionally/.test(c)) return null;

  const x = /^(\d+)\s*(?:x|times)\s*(?:\/|per|a)?\s*week/.exec(c);
  if (x) return Number(x[1]);

  // "~5k/week" is a distance, not a frequency. Anything with a unit in front of
  // the slash is not answering this question.
  return null;
}

export type CadenceConflict = {
  /** What the cadence says. */
  saysTimes: number;
  /** How many days it is actually planned on. */
  plannedDays: number;
};

/**
 * Does this row's cadence disagree with the days it is planned on?
 *
 * Ruth's example: Gym says "1x/week" and is planned Monday and Thursday. Both
 * are things she told the app, at different times, and NEITHER IS OBVIOUSLY THE
 * MISTAKE - which is exactly why the app asks rather than picks. Silently
 * choosing one would make one of her own answers disappear.
 *
 * ONLY WHEN BOTH ARE DEFINITE. No days planned is not a disagreement - that is
 * an Anytime activity. A cadence with no number in it is not a disagreement
 * either.
 */
export function cadenceConflict(cadence: string | null, days: string[]): CadenceConflict | null {
  const says = timesPerWeek(cadence);
  if (says == null) return null;
  const planned = (days ?? []).length;
  if (planned === 0) return null;
  if (planned === says) return null;
  // Daily means seven, and six planned days is not somebody contradicting
  // herself - it is somebody who has not dragged the seventh on yet.
  if (says === 7) return null;
  return { saysTimes: says, plannedDays: planned };
}

/** The cadence text that matches N planned days, for the "days are right" answer. */
export function cadenceForDays(count: number): string {
  if (count >= 7) return 'Daily';
  return `${count}x/week`;
}

// ---------------------------------------------------------------- matching

/**
 * Does a logged activity correspond to this planned one?
 *
 * MATCHED ON THE NAME, LOOSELY, AND THAT IS A KNOWN LIMIT. An activity logged
 * as "gym session" should tick the "Gym" card; one logged as "ballet class"
 * should tick "Ballet". There is no id linking a log to a plan row, and adding
 * one would mean the chat logging path had to know about the week, which it
 * does not and should not.
 *
 * THE FAILURE MODE IS THE SAFE ONE. A missed match means no tick, and a missing
 * tick says nothing - the screen never claims anything did not happen. A false
 * match would be the bad direction, so the comparison is deliberately
 * conservative: whole words, one contained in the other, nothing fuzzier.
 */
export function logMatchesPlan(loggedName: string, plannedActivity: string): boolean {
  const norm = (s: string) =>
    (s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(loggedName);
  const b = norm(plannedActivity);
  if (!a || !b) return false;
  if (a === b) return true;
  // "Park / calisthenics" is stored with a slash; either half should match.
  const plannedParts = b.split(' ').filter((w) => w.length > 2);
  const loggedParts = a.split(' ').filter((w) => w.length > 2);
  return plannedParts.some((w) => loggedParts.includes(w));
}

/**
 * Walking is its own card and is never a pill on a day.
 *
 * It is the one activity the phone already counts, so it has a number of its
 * own every day and nothing to tick. Ruth's design gives it a full-width card
 * reading "daily · 7,242 steps today", which is a different thing from a plan.
 */
export function isWalking(activity: string): boolean {
  return /^walk(ing)?$/i.test((activity ?? '').trim());
}

// WHERE DOES THIS ACTIVITY SIT THIS WEEK - one answer, one place.
//
// The days on a user_week row are a SUGGESTION, written when the plan was. Two
// screens need to know whether to honour that suggestion (the week itself, and
// the "Log the week" sheet), and they must never disagree: a sheet that offers
// Thursday for something the week shows in Anytime is the app arguing with
// itself in front of her.
//
// "Guide me" honours the plan. "Let me lead" does not, until she has moved the
// card herself - which is what days_chosen_at records.
export function placedOnDays(
  guidance: string | null,
  row: { days: string[] | null; days_chosen_at: string | null }
): string[] {
  if (guidance === 'let_me_lead' && !row.days_chosen_at) return [];
  return row.days ?? [];
}
