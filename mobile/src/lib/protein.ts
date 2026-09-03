// The daily protein target (Part Eight).
//
// THREE SOURCES, IN THIS ORDER, and the third one is silence.
//
//   1. A target the person set themselves. Outranks every calculation. Someone
//      who has been told what the numbers suggest and chosen differently has
//      not made a mistake for the app to correct on the next render.
//   2. Lean body mass x 2.0-2.4, where a body fat reading exists.
//   3. Bodyweight x 1.6-2.0, where only a weight exists.
//   4. Nothing. No number at all.
//
// LEAN MASS COMES FROM BODY FAT PERCENTAGE, NOT FROM `muscle_kg` (2026-09-03).
// The previous formula was muscle_kg x 2.2, and it was retired because
// `muscle_kg` is not a standardised field: some manufacturers report skeletal
// muscle mass under that label, some lean body mass, some fat-free mass. Three
// scales disagree by kilograms on the same body, so the target depended on which
// scale someone owned. Body fat percentage is the most consistently defined
// output across brands.
//
// THE UNIT IS A CORRECTNESS REQUIREMENT, not a style note. `body_fat_pct` is
// stored as a percentage - 26.4, not 0.264 - so the formula divides by 100.
// Without that, weight x (1 - 26.4) returns about MINUS 1,396 kg.
//
// A RANGE, NOT A POINT. The evidence supports a span, and saying so lets someone
// choose inside it rather than accept a figure they had no part in. Only a
// manually chosen target is a single number, because that one is theirs.
//
// THE TWO CALCULATED PATHS ARE KEPT COMPARABLE ON PURPOSE. At 55 kg and 26.4%
// body fat the lean-mass path gives 81-97 g and the bodyweight path 88-110 g:
// overlapping, about 10% apart at the midpoint. Acquiring a smart scale must
// never move someone's target sharply, or measuring reads as a penalty. Change
// one multiplier and you check it against the other before shipping.
//
// Mirrored by proteinTarget in app/lib/body-metrics.ts. They are the same rule
// on both sides of the Next/Expo boundary, and a divergence would have
// onboarding state one number while the Overview shows another.

export type ProteinTarget =
  | { kind: 'manual'; grams: number }
  | { kind: 'range'; low: number; high: number; basis: 'lean_mass' | 'bodyweight' };

// A body fat percentage outside this band is not a body fat percentage. It
// catches the fraction-vs-percentage mistake at runtime (0.264 falls below it)
// rather than letting it through as a lean mass of 54.8 kg on a 55 kg person.
const MIN_PLAUSIBLE_BF_PCT = 3;
const MAX_PLAUSIBLE_BF_PCT = 70;

export function leanBodyMassKg(
  weightKg: number | null | undefined,
  bodyFatPct: number | null | undefined
): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  if (bodyFatPct == null) return null;
  if (bodyFatPct < MIN_PLAUSIBLE_BF_PCT || bodyFatPct > MAX_PLAUSIBLE_BF_PCT) return null;
  return weightKg * (1 - bodyFatPct / 100);
}

export function calculateProteinTarget(
  manualG: number | null | undefined,
  weightKg: number | null | undefined,
  bodyFatPct: number | null | undefined
): ProteinTarget | null {
  if (manualG != null && manualG > 0) {
    return { kind: 'manual', grams: Math.round(manualG) };
  }

  const lbm = leanBodyMassKg(weightKg, bodyFatPct);
  if (lbm != null && lbm > 0) {
    return {
      kind: 'range',
      low: Math.round(lbm * 2.0),
      high: Math.round(lbm * 2.4),
      basis: 'lean_mass',
    };
  }

  if (weightKg != null && weightKg > 0) {
    return {
      kind: 'range',
      low: Math.round(weightKg * 1.6),
      high: Math.round(weightKg * 2.0),
      basis: 'bodyweight',
    };
  }

  return null;
}

// What a surface shows beside a logged figure: "of 95" for a chosen target,
// "of 81-97 g" for a calculated span. Null when there is nothing to show, which
// the Overview already renders as a figure with no denominator rather than
// inventing one.
export function proteinTargetLabel(target: ProteinTarget | null): string | null {
  if (target == null) return null;
  return target.kind === 'manual' ? `${target.grams}` : `${target.low}-${target.high}`;
}
