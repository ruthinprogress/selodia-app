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

export type FlowerMode = 'week' | 'month';

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

/** Local midnight on the Monday of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay is 0 for Sunday, and the week starts on Monday everywhere else in
  // this app, so Sunday counts as the seventh day of the week before it.
  const shift = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - shift);
  return out;
}

/** Whole days between two local midnights. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * The window to draw, `back` steps before the one containing `now`.
 *
 * back = 0 is the current week or month, 1 is the one before it, and so on.
 */
export function flowerRange(mode: FlowerMode, back: number, now: Date = new Date()): FlowerRange {
  const steps = Math.max(0, Math.min(MAX_BACK, Math.round(back)));

  if (mode === 'week') {
    const from = mondayOf(now);
    from.setDate(from.getDate() - steps * 7);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return {
      from,
      to,
      label: steps === 0 ? 'this week' : steps === 1 ? 'last week' : `week of ${dayMonth(from)}`,
      days: 7,
    };
  }

  // A CALENDAR MONTH, NOT FOUR WEEKS. Paging back through months and landing on
  // "week of 8 September" would be the app answering a different question from
  // the one the button asked. setMonth handles the lengths and the year turn.
  const from = new Date(now.getFullYear(), now.getMonth() - steps, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return {
    from,
    to,
    label:
      steps === 0
        ? 'this month'
        : from.getFullYear() === now.getFullYear()
          ? MONTHS[from.getMonth()]
          : `${MONTHS[from.getMonth()]} ${from.getFullYear()}`,
    days: daysBetween(from, to),
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
