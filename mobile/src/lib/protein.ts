// The daily protein target (Part Eight).
//
// THREE SOURCES, IN THIS ORDER, and the third one is silence.
//
//   1. A target the person set themselves. Outranks everything, including a
//      calculation from a real muscle-mass reading. Someone who has been told
//      what the numbers suggest and chosen differently has not made a mistake
//      for the app to correct on the next render.
//   2. Lean mass x 2.2, where a bioimpedance reading exists. Part Eight's basis,
//      because lean mass stays accurate in a deficit where bodyweight does not.
//   3. Nothing. No number at all.
//
// THE BODYWEIGHT FALLBACK IS GONE (2026-09-01), and its removal is the point of
// this file's rewrite. It used to return bodyweight x 2.2 whenever no scale
// reading existed, which was wrong twice over: the wrong input, and a confident
// specific figure manufactured from data that could not support one. "121 g"
// reads as a measurement. It was an assumption wearing a measurement's clothes,
// and it was shown on the Overview bar as though it had been derived from
// something.
//
// Returning null is the honest answer, and the surfaces are built to take it —
// the Overview bar already renders "84 g logged" with no target rather than
// inventing a denominator. The gap that leaves is filled by ASKING, during
// onboarding, with a range instead of a number (see app/lib/onboarding-targets.ts).

export type ProteinTarget = {
  grams: number;
  source: 'manual' | 'muscle_mass';
};

export function calculateProteinTarget(
  manualG: number | null | undefined,
  muscleKg: number | null | undefined
): ProteinTarget | null {
  if (manualG != null && manualG > 0) {
    return { grams: Math.round(manualG), source: 'manual' };
  }
  if (muscleKg != null && muscleKg > 0) {
    return { grams: Math.round(muscleKg * 2.2), source: 'muscle_mass' };
  }
  return null;
}

// The range offered when there is no muscle-mass reading to work from.
//
// SCALED, NOT FIXED. 1.6-2.0 g per kg of bodyweight is the ordinary evidence-based
// span for an active person, and scaling it means "at your weight" is true for
// whoever is reading it rather than a phrase attached to someone else's numbers.
//
// A RANGE IS NOT A HEDGE, it is the honest shape of the answer. Without lean mass
// the data genuinely supports a span and not a point, and saying so lets someone
// choose inside it rather than accept a figure they had no part in.
export function proteinRange(weightKg: number | null | undefined): { low: number; high: number } | null {
  if (weightKg == null || weightKg <= 0) return null;
  return { low: Math.round(weightKg * 1.6), high: Math.round(weightKg * 2.0) };
}
