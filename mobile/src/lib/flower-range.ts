// WHICH STRETCH OF TIME THE FLOWER IS DRAWING, with no database in sight.
//
// Ruth, 7 October 2026, revising her own nav proposal after I said a custom
// range was the one genuinely new piece of work:
//
//   "if it's going to cause trouble just do Week and Month ranges, each one has
//   a back and forward button so the flower shows weekly and monthly snapshots.
//   the report builder is the place where a user can already create a custom
//   range... the daily use flower is more bounded. Better plan from a coding and
//   reliability of function position?"
//
// It is, and for a reason worth writing down. A free custom range can be three
// days, and a three-day flower would hand most of a tiny target to rest days and
// draw a picture that lies. Two fixed shapes make that impossible rather than
// guarded against.
//
// A RANGE, NOT A COUNT OF WEEKS. The hook used to take `weeks` and count
// backwards from now, which cannot express "September". This returns a real
// from/to pair, so a calendar month is exact, and the report builder's own
// custom range becomes this same shape later with no further work.
//
// EVERY BOUNDARY IS LOCAL AND HALF-OPEN. `from` is inclusive, `to` is exclusive,
// both at local midnight, so a session stamped exactly at midnight lands in one
// window and never in two.

// ROLLING, NOT CALENDAR (Ruth, 20 October 2026):
//
//   "What if it's always the last 7 days or last 30 days as default view
//    starting from the currect day. That way its just the shape of what
//    happened, as opposed of implying that more needs doing this week/month
//    with all the empty petals if its monday or 1st of the month."
//
// SHE FOUND AN ARITHMETIC FAULT, not a preference. A calendar window set
// `days: 7` for "this week" whatever day it actually was, and the target scales
// by that - so on a Monday morning ONE elapsed day was measured against a full
// week's target, and on the 1st of a month one day against thirty-one. The
// drawing was not saying "you have done little this week". It was saying "this
// week has not happened yet", in the visual language of "you have done little",
// on a screen about somebody's body.
//
// THE ORIGINAL DESIGN WAS ROLLING and the reasoning survives in
// balance-flower-section.tsx: "six weeks is long enough for a picture to be
// about somebody's life rather than about their last seven days." Calendar
// windows arrived as a side effect of adding back and forward paging on
// 7 October; nobody ever argued for the boundary on its own merits.
//
// TODAY IS INCLUDED even though it is still in progress, because excluding it
// on a screen called Now would be strange. That leaves at most a one-day
// shortfall against a seven-day target, where the calendar window could be six
// days short - and it never resets to near-nothing overnight.
//
// THE CALENDAR WINDOWS ARE NOT GONE, they moved to where they earn their place.
// Ruth: "going hard 2 weeks and nothing the rest of the time may shoe as
// adequate when it's actually not" - so the report builder gets week-by-week
// and month-by-month flowers, where the distribution is the point. Here, where
// the question is "what has my life looked like lately", rolling is the honest
// shape.
export type FlowerMode = 'days7' | 'days30';

/** How many days each mode looks back over, today included. */
export const MODE_DAYS: Record<FlowerMode, number> = { days7: 7, days30: 30 };

export type FlowerRange = {
  from: Date;
  to: Date;
  /** What the sentence under the flower calls this stretch. */
  label: string;
  /** Days in the window, which is what scales the target. */
  days: number;
};

/**
 * How far back she may page.
 *
 * A LIMIT RATHER THAN HER FIRST LOGGED DAY, deliberately and for now. The true
 * floor is the date of her earliest activity row, which is a second query on a
 * screen that currently costs one. Twelve windows is a season of weeks or a year
 * of months, and a window with nothing in it says so honestly rather than
 * pretending, so paging past the data is informative rather than broken.
 */
export const MAX_BACK = 12;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// mondayOf AND daysBetween WENT WITH THE CALENDAR WINDOWS, 20 October 2026.
// Both existed only to find a week boundary or measure an uneven month, and a
// rolling window has neither. Deleted rather than left: an exported helper
// nothing calls is the next person's evidence that weeks still matter here.
// lib/week.ts has its own mondayOf for the Week tab, which genuinely does start
// on a Monday.

/**
 * The window to draw: `length` days ending today, stepped back by whole windows.
 *
 * back = 0 is the stretch ending today, 1 is the stretch before that, and so
 * on - so paging never lands on a part-window and the target always matches the
 * days in it.
 *
 * EVERY WINDOW IS THE SAME LENGTH, which is what makes the denominator honest
 * and the drawings comparable. A calendar month could not promise that: thirty
 * days against thirty-one is a different target for the same effort.
 */
export function flowerRange(mode: FlowerMode, back: number, now: Date = new Date()): FlowerRange {
  const steps = Math.max(0, Math.min(MAX_BACK, Math.round(back)));
  const length = MODE_DAYS[mode];

  // Half-open and local, as before: `to` is the midnight AFTER today, so
  // anything logged today is inside the window and nothing is in two windows.
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  to.setDate(to.getDate() + 1 - steps * length);
  const from = new Date(to);
  from.setDate(from.getDate() - length);

  return {
    from,
    to,
    // IT SAYS WHAT IT IS. "this week" invited the reading she objected to -
    // that the week is a thing with a shape you are filling. "the last 7 days"
    // is a description of a stretch of time that has already happened.
    label:
      steps === 0
        ? `the last ${length} days`
        : `the ${length} days to ${dayMonth(new Date(to.getTime() - 86_400_000))}`,
    days: length,
  };
}

/** "8 September", for a week that is not this one or last. */
function dayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Whether the forward button does anything.
 *
 * There is no future to page into, so at back = 0 forward is off rather than
 * drawing a window that cannot contain anything.
 */
export function canGoForward(back: number): boolean {
  return back > 0;
}

export function canGoBack(back: number): boolean {
  return back < MAX_BACK;
}

/**
 * The window length in weeks, which is what scales the flower's target.
 *
 * Fractional on purpose. A 31-day month is 4.43 weeks, and rounding it to 4
 * would set a target 10% too low and fill every petal that bit too easily. The
 * target arithmetic is a multiplication, so a fraction costs nothing.
 */
export function weeksIn(range: FlowerRange): number {
  return range.days / 7;
}
