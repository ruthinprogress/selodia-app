// THE SHAPE OF THE FLOWER, with nothing that knows how to draw it.
//
// Ruth, 20 October 2026: "Would it be useful to have a health flower in Week...
// Then report builder flower, yes."
//
// WHY THIS IS NOW ITS OWN FILE. The numbers below lived inside
// health-flower.tsx, which imports react-native-svg - so the only way to draw
// this flower anywhere else was to type the numbers again. The report is built
// on the server and rendered as HTML, which cannot import a React Native
// component, and a second set of petal measurements is a second drawing of one
// idea waiting to drift from the first.
//
// It is the same split this project made three times in one week, for the same
// reason each time: week-reminder-time, calendar-time and me-archive-sort all
// came out of components so something other than a phone could read them.
//
// NOTHING HERE CHANGED IN THE MOVE. Every constant, and petalFor itself, is
// exactly as health-flower.tsx carried it, comments included - this file is a
// relocation, not a rewrite, and app/lib/health-flower-dimensions.ts is
// generated from it so the PDF cannot draw a different flower from the app.

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
