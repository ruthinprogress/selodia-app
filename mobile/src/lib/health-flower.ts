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

// True only when every dimension is genuinely full. This is what makes the seed
// appear, so it is an exact test rather than a nearly: a flower that blooms at
// 97% would make the moment cheap, and the moment is the whole point of it.
export function allDimensionsFull(c: FlowerCoverage): boolean {
  return DIMENSIONS.every((d) => c[d] >= 100);
}
