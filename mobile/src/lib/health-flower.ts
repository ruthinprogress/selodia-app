// The Health Flower's maths, kept out of the hook so it can be reasoned about
// and tested without a database.
//
// WHAT COVERAGE MEANS. Each logged activity carries six stored percentages, one
// per dimension, written when the row was created (see app/lib/activity-weights.ts).
// A dimension's weekly coverage is the sum of those contributions across the
// week, divided by a target, capped at 100.
//
// THE TARGET IS 200, AND IT IS A CHOICE, NOT A MEASUREMENT. The spec says
// coverage is "the sum of weighted contributions across all sessions logged that
// week", which on its own has no ceiling: yoga alone is 85% flexibility, so two
// yoga sessions would be 170 and three 255. A denominator is what turns a sum
// into a petal. 200 means roughly two strong sessions fill a dimension, which is
// reachable in an ordinary week without being so easy that the flower is always
// full. It is deliberately one number in one place, because it will want tuning
// once there is a real week of data to look at.
//
// NULL IS NOT ZERO. An unclassified row contributes nothing to any dimension and
// is skipped entirely. That is different from a row classified as contributing
// zero: a rest day genuinely gives 0 to strength, while "Daily Summary" from a
// screenshot gives an unknown amount. Counting the second as the first would
// quietly under-report every dimension, and the person would never know why
// their week looked thinner than it was.

export type Dimension =
  | 'strength'
  | 'cardio'
  | 'flexibility'
  | 'balance'
  | 'bone'
  | 'recovery';

export type FlowerCoverage = Record<Dimension, number>;

export const DIMENSIONS: Dimension[] = [
  'strength',
  'cardio',
  'flexibility',
  'balance',
  'bone',
  'recovery',
];

// Part Eight, confirmed palette. One petal each, in the order above.
export const DIMENSION_COLOUR: Record<Dimension, string> = {
  strength: '#D4846A',
  cardio: '#A8BF9C',
  flexibility: '#C4947A',
  balance: '#7BA99A',
  bone: '#C9A882',
  recovery: '#A89BAE',
};

// The "Explore this" button on each detail screen, and nothing else.
//
// The detail screen's own background is the TRUE petal colour with CHARCOAL
// text on it, because cream on these pastels fails badly: measured, the six run
// 1.79:1 to 2.59:1, which misses even the 3.0 allowed for large text. Charcoal
// on the same unmodified colours runs 4.91:1 to 7.12:1. So the colour stays
// exactly the petal's and the text changes, rather than the reverse.
//
// The button is the one place cream is used, so it needs a ground dark enough
// to carry it. These are each petal darkened until cream clears 5.5:1 - margin
// over the 4.5 threshold rather than sitting on it, because this app already
// rejected 4.39:1 as too low for a 40+ reader.
export const DIMENSION_DEEP: Record<Dimension, string> = {
  strength: '#895544',
  cardio: '#596553',
  flexibility: '#795B4B',
  balance: '#4B675E',
  bone: '#715E49',
  recovery: '#675F6B',
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  flexibility: 'Flexibility',
  balance: 'Balance',
  bone: 'Bone',
  recovery: 'Recovery',
};

export const WEEKLY_TARGET = 200;

// Valid-or-null, never valid-or-guess: this comes off a URL segment, and an
// unrecognised value must not fall through to a default that quietly shows
// somebody the wrong dimension's week.
export function coerceDimension(v: unknown): Dimension | null {
  return typeof v === 'string' && (DIMENSIONS as string[]).includes(v) ? (v as Dimension) : null;
}

// The column a dimension's contribution lives in. Exported because the detail
// screen filters on it and must not re-derive the mapping.
export const COVER_COLUMN: Record<Dimension, string> = {
  strength: 'cover_strength',
  cardio: 'cover_cardio',
  flexibility: 'cover_flexibility',
  balance: 'cover_balance',
  bone: 'cover_bone',
  recovery: 'cover_recovery',
};

// What the detail screen says when a dimension has nothing in it this week.
// Ruth's wording. It states the fact and stops: no prompt to do more, no
// encouragement, nothing that turns an empty week into a task. "That's useful
// to know too" is the whole argument of the app in six words.
export function emptyDimensionLine(d: Dimension): string {
  return `Nothing this week for ${DIMENSION_LABEL[d].toLowerCase()}. That's useful to know too.`;
}

// One activity row as the flower needs it. Every field nullable because every
// column is: a row written before the coverage migration has six nulls, and so
// does anything the weighting table did not recognise.
export type CoverageRow = {
  cover_strength: number | null;
  cover_cardio: number | null;
  cover_flexibility: number | null;
  cover_balance: number | null;
  cover_bone: number | null;
  cover_recovery: number | null;
};

const COLUMN_FOR: Record<Dimension, keyof CoverageRow> = {
  strength: 'cover_strength',
  cardio: 'cover_cardio',
  flexibility: 'cover_flexibility',
  balance: 'cover_balance',
  bone: 'cover_bone',
  recovery: 'cover_recovery',
};

export const EMPTY_COVERAGE: FlowerCoverage = {
  strength: 0,
  cardio: 0,
  flexibility: 0,
  balance: 0,
  bone: 0,
  recovery: 0,
};

// Sum, divide, cap. Rounded to a whole percent because the petal is drawn from
// it and a fractional percent is a difference nobody can see.
export function coverageFromRows(rows: CoverageRow[]): FlowerCoverage {
  const out = { ...EMPTY_COVERAGE };
  for (const d of DIMENSIONS) {
    const col = COLUMN_FOR[d];
    let sum = 0;
    for (const r of rows) {
      const v = r[col];
      // Skips null AND skips anything non-finite. The column is numeric and
      // Supabase can hand a numeric back as a string, so this is not paranoia.
      if (typeof v === 'number' && Number.isFinite(v)) sum += v;
    }
    out[d] = Math.min(100, Math.round((sum / WEEKLY_TARGET) * 100));
  }
  return out;
}

/**
 * Recovery earned outside the activity table, folded in.
 *
 * Sleep and rest days are not sessions, so they never appear in the cover_*
 * columns - but they are the larger part of what recovery actually is. Added
 * here rather than invented as fake activity rows, because a night's sleep is
 * not a workout and the Movement log must never show one.
 */
export function withExtraRecovery(c: FlowerCoverage, points: number): FlowerCoverage {
  if (!Number.isFinite(points) || points <= 0) return c;
  const asPercent = Math.round((points / WEEKLY_TARGET) * 100);
  return { ...c, recovery: Math.min(100, c.recovery + asPercent) };
}

// True only when every dimension is genuinely full. This is what makes the seed
// appear, so it is an exact test rather than a nearly: a flower that blooms at
// 97% would make the moment cheap, and the moment is the whole point of it.
export function allDimensionsFull(c: FlowerCoverage): boolean {
  return DIMENSIONS.every((d) => c[d] >= 100);
}

// ONE SENTENCE UNDER THE WHEEL (Ruth, 25 September 2026: the wheel "feels
// stranded ... now the wheel teaches, not decorates").
//
// IT OBSERVES AND STOPS THERE. The note it answers carried a second sentence -
// "adding one strength session would create a more balanced week" - and that
// half is not built, on purpose and with her agreement. It is a prescription,
// and it tells somebody their week is unbalanced before they have said whether
// they minded. ACKNOWLEDGE, DO NOT EVALUATE is written in capitals in the
// app's own prompt, and a line the app prints has to keep the rule the model is
// held to. Naming what led the week is an observation; recommending the
// remedy is every other health app.
//
// NO "THIS WEEK" IN ANY OF THEM. The section heading two lines above says
// "This week", and a sentence that says it again is the app talking twice. It
// also costs a line: every one of these wraps at 296 points, and the line it
// saves is a line of Health Flower.
//
// FIVE CASES, AND EACH SAYS SOMETHING DIFFERENT:
//
//   nothing logged      no sentence at all. There is no observation to make,
//                       and "you have done nothing this week" is not one.
//   every one full      the bloom already says it; the sentence says what the
//                       bloom means rather than repeating the word.
//   all six close        the week is called evenly spread.
//   one clear leader    it is named.
//   two or more tied    both are named, rather than one picked by a point.
//
// "EVENLY SPREAD" IS ABOUT ALL SIX, NOT THE TOP TWO. The first version of this
// asked only whether the leader was clear of the runner-up, which said "fairly
// evenly spread" over a week with a full strength petal and almost no
// flexibility - because the top two happened to be close to each other. The
// sentence is a claim about somebody's week and it has to be true of the
// drawing it sits under, so the test is the whole RANGE: highest minus lowest.
// Caught by looking at the screenshot beside the sentence, which is the only
// reason it was caught at all.
//
// The gap that counts as "clear" is 10 points of a 100-point scale. Below that
// a difference is an artefact of rounding, and naming a leader would be the
// app being confident about something it cannot really see.
const CLEAR_LEAD = 10;

export function weekObservation(c: FlowerCoverage): string | null {
  const ranked = [...DIMENSIONS].sort((a, b) => c[b] - c[a]);
  const top = ranked[0];
  const lowest = ranked[ranked.length - 1];

  if (c[top] <= 0) return null;
  if (allDimensionsFull(c)) return 'All six have had your attention.';
  if (c[top] - c[lowest] < CLEAR_LEAD) return 'Your week has been fairly evenly spread.';

  // Everyone within a rounding error of the leader shares the sentence.
  //
  // AND A TIE AT THE TOP IS NOT AN EVEN WEEK. The version before this one sent
  // three joint leaders back to "fairly evenly spread", which printed exactly
  // that over the store account's week: strength, bone and recovery all at 100
  // with flexibility at 57. Three dimensions full and three not is a shape, and
  // calling it even is the same untruth the range test was added to stop -
  // reached the other way round. Only the range decides evenness; past that
  // every branch names what led.
  const leaders = ranked.filter((d) => c[top] - c[d] < CLEAR_LEAD);
  const named = leaders.slice(0, 3).map((d) => DIMENSION_LABEL[d]);

  if (leaders.length === 1) {
    return `${named[0]} has had most of your attention.`;
  }
  if (leaders.length === 2) {
    return `${named[0]} and ${named[1]} have had most of your attention.`;
  }
  if (leaders.length === 3) {
    return `${named[0]}, ${named[1]} and ${named[2]} have had most of your attention.`;
  }
  // Four or five joint leaders over a spread week. Listing them all reads as a
  // recital, and the one or two left out are the only real information in it -
  // which is a sentence about what somebody did NOT do, and this app does not
  // write those.
  return 'Most of the six have had your attention.';
}
