// WHERE A DAY SITS IN A CYCLE, AND WHEN TWO DAYS ARE THE SAME PLACE.
//
// Ruth, 9 October 2026, scoping the cycle screens. The line the whole feature
// exists to show is "you logged something like this around this point in August
// and July". Getting that line right is entirely this file.
//
// WHY computeCycleDayAndPhase IS NOT ENOUGH. It takes the LAST period start, so
// it can only place today. Every cross-cycle question is about a past date, and
// a past date needs the whole history to know which cycle it fell in.
//
// AND WHY "DAY 14" IS NOT A PLACE. Her own cycles ran 24, 35, 26 and 31 days in
// four months. Ovulation in a 24-day cycle is around day 10; in a 35-day cycle
// it is around day 21. Comparing "day 14" across those compares three different
// phases and calls them one, which is precisely the error this app exists not
// to make - the whole premise is that an irregular cycle is information rather
// than noise to be averaged away.
//
// WHAT IS ACTUALLY STABLE. The LUTEAL phase - ovulation to the next period - is
// roughly 12 to 14 days whatever the cycle length. The follicular phase is what
// stretches and shrinks. So:
//
//   EARLY in a cycle, counting FORWARD from the period start is meaningful,
//   because the bleed and the days after it start when the cycle starts.
//
//   LATE in a cycle, counting BACKWARD from the NEXT period is meaningful,
//   because those days are pinned to the end, not the beginning.
//
//   IN THE MIDDLE, neither is reliable unless the two cycles are a similar
//   length, because that is exactly where the stretch happens.
//
// THE CURRENT CYCLE CANNOT BE COUNTED BACKWARD AT ALL - its next period has not
// happened. So a day late in the current cycle can only be placed forward, and
// is only comparable to cycles of a similar length. This is stated rather than
// hidden, because quietly comparing it anyway is how a tracker tells somebody
// something confident and wrong.

/** A period start, and the start of the one after it. */
export type Cycle = {
  /** ISO date of the period start that opens this cycle. */
  start: string;
  /** ISO date of the NEXT period start, or null when this is the current one. */
  next: string | null;
  /** Whole days, or null when the cycle has not finished. */
  length: number | null;
};

export type Placement = {
  cycle: Cycle;
  /** 1 on the day the period started. */
  dayFromStart: number;
  /** Days until the next period began. Null in the current cycle. */
  daysBeforeNext: number | null;
  /**
   * Which end of the cycle this day is pinned to, and therefore how it may be
   * compared. See the header.
   */
  anchor: 'early' | 'late' | 'middle';
};

/** A day this near the start is pinned to the start. Covers the bleed and a little after. */
export const EARLY_DAYS = 7;
/** A day this near the next period is pinned to the end: the luteal stretch. */
export const LATE_DAYS = 14;
/**
 * How different two cycles may be before a middle-of-cycle position stops
 * meaning the same thing in both. Four days either way: wide enough that
 * ordinary month-to-month variation still compares, narrow enough that a
 * 24-day and a 35-day cycle never do.
 */
export const COMPARABLE_LENGTH_TOLERANCE = 4;

const MS_PER_DAY = 86_400_000;

function midnight(d: string | Date): number {
  const v = new Date(d);
  return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
}

function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((midnight(b) - midnight(a)) / MS_PER_DAY);
}

/**
 * Turn a list of period start dates into cycles.
 *
 * Sorted and de-duplicated here rather than trusted, because these come from
 * cycle_events where a start can be marked twice and where the caller's order
 * is not guaranteed. The newest cycle has next: null - it is the one she is in.
 */
export function buildCycles(periodStarts: readonly string[]): Cycle[] {
  const starts = [...new Set(periodStarts.map((s) => new Date(s).toISOString().slice(0, 10)))]
    .sort();
  return starts.map((start, i) => {
    const next = i + 1 < starts.length ? starts[i + 1] : null;
    return { start, next, length: next ? daysBetween(start, next) : null };
  });
}

/**
 * Which cycle a date fell in, and where.
 *
 * Null when the date is before any recorded period - there is no cycle to place
 * it in, and inventing one by assuming a length is the kind of guess this file
 * exists to refuse.
 */
export function placeInCycle(cycles: readonly Cycle[], date: string | Date): Placement | null {
  const at = midnight(date);
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i];
    if (at < midnight(c.start)) continue;
    if (c.next && at >= midnight(c.next)) continue;
    const dayFromStart = daysBetween(c.start, date) + 1;
    const daysBeforeNext = c.next ? daysBetween(date, c.next) : null;
    return { cycle: c, dayFromStart, daysBeforeNext, anchor: anchorFor(dayFromStart, daysBeforeNext) };
  }
  return null;
}

function anchorFor(dayFromStart: number, daysBeforeNext: number | null): Placement['anchor'] {
  if (dayFromStart <= EARLY_DAYS) return 'early';
  // A day can only be called late if we know where the end was. In the current
  // cycle it cannot, however late it feels.
  if (daysBeforeNext !== null && daysBeforeNext <= LATE_DAYS) return 'late';
  return 'middle';
}

/**
 * Is `other` the same place in its cycle as `target` is in hers?
 *
 * The three cases from the header, in order. Returns false rather than
 * guessing whenever the two cannot be compared honestly - which includes every
 * middle-of-cycle comparison between cycles of very different lengths, and
 * every late-phase comparison involving the cycle she is still in.
 */
export function samePlace(
  target: Placement,
  other: Placement,
  tolerance = 2
): boolean {
  if (target.anchor !== other.anchor) {
    // One pinned to the start and one to the end are not the same place even
    // if the day numbers happen to agree.
    return false;
  }
  if (target.anchor === 'early') {
    return Math.abs(target.dayFromStart - other.dayFromStart) <= tolerance;
  }
  if (target.anchor === 'late') {
    if (target.daysBeforeNext === null || other.daysBeforeNext === null) return false;
    return Math.abs(target.daysBeforeNext - other.daysBeforeNext) <= tolerance;
  }
  // MIDDLE. Only when the cycles are a similar length, because that is the
  // stretch that moves ovulation about.
  const a = target.cycle.length;
  const b = other.cycle.length;
  if (a === null || b === null) return false;
  if (Math.abs(a - b) > COMPARABLE_LENGTH_TOLERANCE) return false;
  return Math.abs(target.dayFromStart - other.dayFromStart) <= tolerance;
}

/**
 * How to describe the position out loud.
 *
 * Deliberately vaguer than the number it is built from. "Around day 14" is
 * honest about a one-day tolerance; "day 14" is not, and a cycle that was 24
 * days last month makes any exact claim worse. Never says a phase name -
 * naming ovulation is a judgement the reply makes in context, not something a
 * date function should assert.
 */
export function describePlace(p: Placement): string {
  if (p.anchor === 'early') return `around day ${p.dayFromStart}`;
  if (p.anchor === 'late' && p.daysBeforeNext !== null) {
    return p.daysBeforeNext <= 1
      ? 'just before your period'
      : `about ${p.daysBeforeNext} days before your period`;
  }
  return `around day ${p.dayFromStart}`;
}
