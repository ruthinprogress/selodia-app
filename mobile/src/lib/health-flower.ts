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
//
// THE TARGET SCALES WITH THE WINDOW (2026-09-25). The flower moved off Today
// and onto the Almanac as a six-week rolling view (Ruth, item 8), and six
// weeks of sessions over ONE week's target would peg every petal at 100 and
// make the drawing say nothing at all. `weeks` is how many weeks the rows
// span, so a six-week flower asks for six weeks of work to fill. One week
// behaves exactly as before.
export function coverageFromRows(rows: CoverageRow[], weeks = 1): FlowerCoverage {
  const target = WEEKLY_TARGET * Math.max(1, weeks);
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
    out[d] = Math.min(100, Math.round((sum / target) * 100));
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
export function withExtraRecovery(c: FlowerCoverage, points: number, weeks = 1): FlowerCoverage {
  if (!Number.isFinite(points) || points <= 0) return c;
  // Against the same scaled target as everything else, or a six-week flower
  // would fill its recovery petal six times as fast as its cardio one.
  const asPercent = Math.round((points / (WEEKLY_TARGET * Math.max(1, weeks))) * 100);
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

// THE WINDOW NAMES ITSELF NOW, and the rule that used to live here still holds.
//
// This was a lookup of one sentence per window, written that way because English
// does not let one noun stand in for another: substituting into a fixed sentence
// gave "Your six weeks has been fairly evenly spread", a plural noun against a
// singular verb.
//
// Since 7 October the windows are a week or a calendar month, chosen with a back
// and a forward button, so the names are unbounded - "this week", "last week",
// "September", "week of 8 September". A lookup cannot hold them.
//
// AND THE PROMISE INVERTED ON 20 OCTOBER 2026. It used to be that every name
// was SINGULAR - "this week", "September" - so "has been" was right for all of
// them. The windows went rolling that day and every name became plural: "the
// last 7 days", "the 7 days to 13 October". The one clause was still "has
// been", so the app printed "The last 7 days has been fairly evenly spread."
//
// The check that was meant to catch exactly this did not, because it called
// flowerRange with the old mode names. An unknown mode returned a window of
// `undefined` days labelled "the last undefined days", which is plural-proof,
// sentence-cased and contains neither "weeks" nor "months" - so every
// assertion passed on a string no screen could ever show. A check that calls a
// function with arguments the function no longer accepts is not testing the
// function.
//
// So the property is the same shape and the opposite value: every label
// flower-range.ts can produce is PLURAL, and the check now asserts that, and
// asserts the labels are real.
export function evenlySpread(period: string): string {
  const named = period.trim() || 'the last 7 days';
  return `${named.charAt(0).toUpperCase()}${named.slice(1)} have been fairly evenly spread.`;
}

export function weekObservation(c: FlowerCoverage, period: string = 'your week'): string | null {
  const ranked = [...DIMENSIONS].sort((a, b) => c[b] - c[a]);
  const top = ranked[0];
  const lowest = ranked[ranked.length - 1];

  if (c[top] <= 0) return null;
  // Same rule: what she did is the subject, and the six are what it built.
  if (allDimensionsFull(c)) return 'What you did reached all six.';
  if (c[top] - c[lowest] < CLEAR_LEAD) return evenlySpread(period);

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

  // THE ACTIVITIES ARE THE ACTOR, NOT THE DIMENSIONS (Ruth, 20 October 2026).
  //
  // This said "has had most of your attention", which describes how she spent
  // herself rather than what she got. Changed to "has done most of the work",
  // which she also rejected, and the second reason is the better one:
  //
  //   "The balance and strength haven't done the work, whatever activities were
  //    done did the work and accumulated the protective qualities. The summary
  //    should give interpretation thats an additional understanding/literacy to
  //    that the flower shows. It explains what the flower shows."
  //
  // Strength is not an agent. It is a protective quality that a week of
  // activity built up, and a sentence that makes it the subject teaches the
  // reader the wrong model of their own body.
  //
  // SO THE SENTENCE IS A READING OF THE DRAWING. Petal lengths say which
  // qualities grew; this says it in words, with what she did as the thing that
  // did it. That is the literacy she means - somebody who reads this a few
  // times learns that a ballet class is building four things at once, which is
  // not visible from a list of logged sessions.
  //
  // STILL ONE CLAUSE AND STILL NO SECOND SENTENCE. See the note below about
  // never naming what was left out.
  if (leaders.length === 1) {
    return `Most of what you did built ${named[0].toLowerCase()}.`;
  }
  if (leaders.length === 2) {
    return `Most of what you did built ${named[0].toLowerCase()} and ${named[1].toLowerCase()}.`;
  }
  if (leaders.length === 3) {
    return `Most of what you did built ${named[0].toLowerCase()}, ${named[1].toLowerCase()} and ${named[2].toLowerCase()}.`;
  }
  // Four or five joint leaders over a spread week. Listing them all reads as a
  // recital, and the one or two left out are the only real information in it -
  // which is a sentence about what somebody did NOT do, and this app does not
  // write those.
  return 'Most of the six have had your attention.';
}
