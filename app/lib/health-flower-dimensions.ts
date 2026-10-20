// GENERATED FILE. DO NOT EDIT.
//
//   node scripts/generate-report-flower.mjs
//
// The Health Flower, for the report. Copied verbatim from
// mobile/src/lib/health-flower.ts and
// mobile/src/lib/flower-geometry.ts.
//
// The report is built on the server and rendered as HTML; the flower is a
// React Native component on the phone. Both now draw from these numbers, so
// the flower in a PDF somebody hands to a doctor is the same object as the one
// on her screen rather than a second drawing of it.
//
// check-report-flower.mjs fails if this file and the phone's stop matching.
// Change the phone's files, then run the command above.

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

// THE GEOMETRY IS THE APPROVED DESIGN'S (Ruth, 11 September; confirmed on 12
// September as the fix for the flower's "render bug"). It is the same drawing the
// ElevenLabs deck carries, so the flower in the deck and the flower in the app
// are one object rather than two drawings of one idea. Taken from
// `2026-09-11 Health Flower approved, in balance.svg` and its part-way sibling in
// Build Specs/Branding & Assets/Visual Assets.
//
//   full petal: ry = 38, tip at 72 from centre, so cy = 38 + ry
//   at P%:      ry = 5 + 33 * P/100, cy = 38 + ry
//
// A full petal runs from 72 out to 4 past the centre, which is what makes the six
// overlap there like a Venn diagram. The previous geometry (12 x 34, tip at 68)
// stopped exactly at the centre, so full petals only touched.
//
// The 5 is a visible floor rather than a clamp, so growth stays monotonic: a
// clamp would draw 5% and 12% at identical size, and two different weeks must
// never produce the same petal.
//
// rx is tied to ry by the full petal's own aspect ratio rather than held
// constant. Holding it constant makes a low-coverage petal a wide flat blob
// lying across the stem, which is not a petal at any size; tying it keeps every
// petal a proper oval pointing outward, whether it is at 8% or 100%. The
// approved part-way file follows the same rule (rx = ry / 3.8 throughout).

export const BOX = 220;
export const CENTRE = 110;
export const FULL_RY = 38;
export const FULL_RX = 10;
export const TIP_Y = CENTRE - 72; // 38
export const ASPECT = FULL_RY / FULL_RX; // 3.8

// The labels sit wider than the 220 square, so the drawing gets a margin either
// side, as the approved file does. The centre stays at 110, the midpoint of the
// range, which is what keeps the seed overlay (positioned at 50% of the
// wrapper) exactly on the flower's centre - so any change here must stay
// symmetric about 110.
//
// WIDENED FROM 26 TO 38 (2026-09-25), to pay for readable labels. See
// LABEL_SIZE: at 9 units the longest of them, "Flexibility", ended at 225 and
// had room to spare. At a size somebody over forty can actually read it ends
// near 248, and a label clipped by the viewBox is a dimension with no name.
export const VIEW_X = -38;
export const VIEW_W = 296;

// A nonzero petal is never invisible. A strictly proportional oval would be
// under a pixel tall at low coverage, which reads as nothing logged rather than
// as a little logged. So the scale runs from a visible floor up to the full
// petal rather than from zero - which also keeps it MONOTONIC: clamping at a
// floor instead would draw 5% and 12% at exactly the same size, and two
// different weeks must not produce the same petal.
export const MIN_VISIBLE_RY = 5;

// Petals overlap at the centre, and at half opacity, as approved, so where two
// meet their colours mix rather than one covering the other. That mixing is the
// whole visual argument of the centre: the dimensions are not separate numbers.
export const PETAL_OPACITY = 0.5;

// THE TIP RING. The radius the petals grow to - 72 from the centre, the same
// number TIP_Y is derived from, so the ring and the tips cannot drift apart.
// Sage, which this palette holds as a line-and-fill colour and never as text,
// and faint: it is the ground the flower sits on, not a mark on it.
export const TIP_RING_R = 72;
export const RING_OPACITY = 0.55;

/**
 * One petal's oval, or null when there is nothing to draw.
 *
 * AT 0% NOTHING RENDERS AT ALL. Not a faint one, not an outline - an outline is
 * a scorecard, and it tells somebody what they failed to do before it tells
 * them what they did.
 */
export function petalFor(coverage: number): { rx: number; ry: number; cy: number } | null {
  if (!Number.isFinite(coverage) || coverage <= 0) return null;
  const pct = Math.min(100, coverage) / 100;
  const ry = MIN_VISIBLE_RY + (FULL_RY - MIN_VISIBLE_RY) * pct;
  return { rx: ry / ASPECT, ry, cy: TIP_Y + ry };
}
