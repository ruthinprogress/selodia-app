// Daily calorie (energy) target from the decided Fat×Muscle combination matrix
// (UNFLUMP_SPEC.md, Part Eight, Calorie Targets — decided 2026-08-15). Pure and
// node-tested. It takes TDEE as an INPUT (never computes it) so the matrix is
// testable in isolation; the caller sources TDEE (scale BMR or estimate ×
// activity multiplier) and reads the Focus states, then feeds them in.
//
// The rule, equivalent to the 3×3 table: Fat Focus sets the energy direction,
// Muscle Focus is a constraint, not a second additive delta.
//  - Surplus  (+150 kcal) when EITHER focus wants growth — fat=increase, or
//    fat=maintain & muscle=increase — and it never stacks.
//  - Deficit  (~0.5%/wk of bodyweight) only when fat=reduce AND muscle≠increase.
//  - Maintenance (= TDEE) for everything else, INCLUDING recomposition
//    (fat=reduce + muscle=increase), which resolves to ≈maintenance with the
//    isRecomposition flag set so the UI frames it as slow simultaneous change.

export type FocusState = 'reduce' | 'maintain' | 'increase';
export type CalorieTargetMode = 'deficit' | 'maintenance' | 'surplus';

export type CalorieTarget = {
  targetKcal: number; // the daily target, rounded to the nearest 10
  mode: CalorieTargetMode;
  isRecomposition: boolean; // reduce fat + increase muscle → maintenance, framed as slow simultaneous change
  deltaKcal: number; // signed daily delta vs TDEE (negative deficit, positive surplus, 0 maintenance)
};

// Energy in one kg of body mass (standard ~7700 kcal/kg), for turning the
// weekly weight-loss rate into a daily kcal deficit.
const KCAL_PER_KG = 7700;
// Default fat-loss rate: 0.5% of bodyweight per week — the evidence-grounded
// slow rate that preserves strength/lean mass (Part Eight; Resources).
const WEEKLY_LOSS_FRACTION = 0.005;
// Gentle-end surplus for lean gain (the spec's preferred end of 150–200).
const SURPLUS_KCAL = 150;
// Targets round to a clean number.
const ROUND_TO = 10;

const roundTo = (n: number, step: number): number => Math.round(n / step) * step;

export function calculateCalorieTarget(params: {
  tdeeKcal: number | null | undefined;
  weightKg: number | null | undefined; // required only for the deficit branch
  fatFocus: FocusState;
  muscleFocus: FocusState;
}): CalorieTarget | null {
  const { tdeeKcal, weightKg, fatFocus, muscleFocus } = params;
  if (tdeeKcal == null || tdeeKcal <= 0) return null;

  // Surplus: either focus wants growth. Doesn't stack, doesn't need bodyweight.
  const wantsGrowth = fatFocus === 'increase' || (fatFocus === 'maintain' && muscleFocus === 'increase');
  if (wantsGrowth) {
    return {
      targetKcal: roundTo(tdeeKcal + SURPLUS_KCAL, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: SURPLUS_KCAL,
    };
  }

  // Deficit: fat-loss without a competing muscle-gain intent. Needs bodyweight.
  if (fatFocus === 'reduce' && muscleFocus !== 'increase') {
    if (weightKg == null || weightKg <= 0) return null;
    const dailyDeficit = Math.round((WEEKLY_LOSS_FRACTION * weightKg * KCAL_PER_KG) / 7);
    return {
      targetKcal: roundTo(tdeeKcal - dailyDeficit, ROUND_TO),
      mode: 'deficit',
      isRecomposition: false,
      deltaKcal: -dailyDeficit,
    };
  }

  // Maintenance: everything else — pure maintenance, and recomposition
  // (fat=reduce + muscle=increase), which is maintenance with the flag set.
  return {
    targetKcal: roundTo(tdeeKcal, ROUND_TO),
    mode: 'maintenance',
    isRecomposition: fatFocus === 'reduce' && muscleFocus === 'increase',
    deltaKcal: 0,
  };
}
