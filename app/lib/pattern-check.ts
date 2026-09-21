// "RUN A REPORT ON ALL DAYS I DRANK COCKTAILS AND MY MOOD THE FOLLOWING DAYS."
//
// Ruth, 21 September 2026, in the same message that put mood back into the app:
//
//   "catching things like low mood always 2 days after cocktails eg, could
//   genuinely be unknown to a user and needs something to check if Ai says it.
//   Also, could the user say, run a report on all days i drank cocktails and my
//   mood the following days?"
//
// The second sentence is this file. The first sentence is why it is built the
// way it is.
//
// THE APP COUNTS, THE MODEL DESCRIBES - the same division as the report
// summary. Every number here is arithmetic on rows, and the model is handed the
// finished figures with an instruction not to compute. A model asked to eyeball
// eleven nights and a column of mood ratings will find a pattern, because that
// is what it is for, and the person has no way to check it.
//
// IT NEVER CONCLUDES. Not "your mood dips two days after drinking", not even
// "there may be a link". It lines the days up, says how many there were, and
// says plainly when there are too few to mean anything. Three matching days is
// a coincidence; an app that calls it a finding has invented a cause out of
// noise and attached it to somebody's body.
//
// THE DAYS THAT DO NOT FIT STAY IN THE TABLE. That is the whole difference
// between a tool for checking a hunch and a tool for confirming one.

export type Alignment = { day: string; after: (number | null)[] };

/** A day moved by a whole number of days. Nonsense comes back unchanged. */
export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/**
 * The days something happened, lined up against the ratings that followed.
 *
 * Offsets are in days: 0 is the day itself, 1 the day after. A day with no
 * rating at that offset is a null and stays a null - dropping it would quietly
 * turn "we have no idea about six of these" into a tidier, falser table.
 */
export function alongside(
  days: string[],
  ratings: { day: string; measure: string; value: number }[],
  offsets: number[],
  measureId: string
): Alignment[] {
  const found = new Map<string, number>();
  for (const r of ratings) {
    if (r.measure !== measureId) continue;
    const v = Math.round(Number(r.value));
    if (Number.isFinite(v) && v >= 1 && v <= 5) found.set(r.day, v);
  }
  return [...new Set(days)]
    .sort()
    .map((day) => ({ day, after: offsets.map((o) => found.get(shiftDay(day, o)) ?? null) }));
}

/**
 * How many of the lined-up slots actually carry a rating.
 *
 * A caller needs this before it draws anything. "Mood on the two days after"
 * across eight nights where six have no rating is a table of blanks pretending
 * to be evidence.
 */
export function coverage(rows: Alignment[]): { have: number; of: number } {
  let have = 0;
  let of = 0;
  for (const r of rows) {
    for (const v of r.after) {
      of += 1;
      if (v != null) have += 1;
    }
  }
  return { have, of };
}

/** The mean of the ratings that exist, to one decimal, or null when there are none. */
export function average(values: (number | null)[]): number | null {
  const have = values.filter((v): v is number => v != null);
  if (have.length === 0) return null;
  return Math.round((have.reduce((a, b) => a + b, 0) / have.length) * 10) / 10;
}

export type Comparison = {
  /** The mean rating on the days that followed the thing. */
  onThose: number | null;
  /** The mean rating on every other rated day in the same window. */
  otherwise: number | null;
  /** How many ratings each mean rests on - the figure that decides whether either means anything. */
  fromThose: number;
  fromOthers: number;
};

/**
 * The two averages, and what each rests on.
 *
 * EVERY OTHER RATED DAY IS THE COMPARISON, not the overall average. An overall
 * average includes the days in question, which drags it toward them and makes
 * any difference look smaller than it is. The days that follow the thing are
 * excluded from "otherwise" for the same reason.
 */
export function compare(
  rows: Alignment[],
  ratings: { day: string; measure: string; value: number }[],
  offsets: number[],
  measureId: string
): Comparison {
  // ONE DAY COUNTS ONCE. Two nights out on Friday and Saturday both point at
  // Sunday when the offset is one, and counting Sunday's rating twice would
  // weight it for no reason other than the shape of the week.
  const onThoseValues: number[] = [];
  const claimed = new Set<string>();
  for (const r of rows) {
    r.after.forEach((v, i) => {
      // THE INDEX IS NOT THE OFFSET. Asked about the day itself and two days
      // later, `after` has two slots holding offsets 0 and 2, and reading the
      // index as a day count would put the second reading on the wrong date.
      const day = shiftDay(r.day, offsets[i] ?? i);
      if (claimed.has(day)) return;
      claimed.add(day);
      if (v != null) onThoseValues.push(v);
    });
  }

  // THE DAYS THEMSELVES ARE NOT ORDINARY DAYS EITHER. Asked about the day
  // AFTER cocktails, the cocktail evenings are neither "those days" nor a fair
  // picture of a normal week, so they sit out of both columns rather than
  // quietly propping up the comparison.
  const excluded = new Set(claimed);
  for (const r of rows) excluded.add(r.day);

  const otherValues: number[] = [];
  for (const r of ratings) {
    if (r.measure !== measureId) continue;
    if (excluded.has(r.day)) continue;
    const v = Math.round(Number(r.value));
    if (Number.isFinite(v) && v >= 1 && v <= 5) otherValues.push(v);
  }

  return {
    onThose: average(onThoseValues),
    otherwise: average(otherValues),
    fromThose: onThoseValues.length,
    fromOthers: otherValues.length,
  };
}

// ENOUGH TO BE WORTH LOOKING AT, which is not the same as enough to conclude
// anything. Below this the table is still shown - she asked to see her own days
// and the app does not get to withhold them - but it is labelled as too few,
// and the model is told to say so rather than read a shape into it.
export const ENOUGH_OCCASIONS = 5;
export const ENOUGH_RATINGS = 6;

export type PatternVerdict = {
  /** Plain English for the model to say back, already true. */
  standing: string;
  /** True when there is genuinely enough to look at. Never means "there is a pattern". */
  worthReading: boolean;
};

/**
 * What can honestly be said about the size of the evidence.
 *
 * This is deliberately about the EVIDENCE, never about the result. It says how
 * many days there were and how many carried a rating. Whether the numbers lean
 * one way is left to the table and the person reading it.
 */
export function verdict(rows: Alignment[], cover: { have: number; of: number }): PatternVerdict {
  const occasions = rows.length;
  if (occasions === 0) {
    return { standing: 'There are no days on record matching that yet.', worthReading: false };
  }
  const day = occasions === 1 ? 'day' : 'days';
  if (cover.have === 0) {
    return {
      standing: `${occasions} ${day} found, but none of the days afterwards have a mood or energy rating on them, so there is nothing to compare yet.`,
      worthReading: false,
    };
  }
  if (occasions < ENOUGH_OCCASIONS || cover.have < ENOUGH_RATINGS) {
    return {
      standing:
        `${occasions} ${day} found, with ${cover.have} of ${cover.of} following days rated. ` +
        'That is too few to read anything into - it is worth seeing, but a handful of days can line up by chance.',
      worthReading: false,
    };
  }
  return {
    standing: `${occasions} ${day} found, with ${cover.have} of ${cover.of} following days rated.`,
    worthReading: true,
  };
}

/** The offsets somebody asked about, cleaned. */
export function readOffsets(v: unknown): number[] {
  const raw = Array.isArray(v) ? v : [v];
  const out: number[] = [];
  for (const item of raw) {
    const n = typeof item === 'number' ? item : Number(item);
    if (!Number.isFinite(n)) continue;
    const d = Math.round(n);
    // SAME DAY TO A WEEK AFTER. Before the day is a different question - what
    // happened before something is not what followed it - and beyond a week
    // nothing is being remembered accurately anyway.
    if (d < 0 || d > 7) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out.length > 0 ? out.sort((a, b) => a - b) : [1];
}
