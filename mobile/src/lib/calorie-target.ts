// Daily calorie (energy) target from the decided Fat×Muscle combination matrix
// (SELODIA_SPEC.md, Part Eight, Calorie Targets — decided 2026-08-15). Pure and
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

// MIRRORED SERVER-SIDE since 2026-09-09, in `app/lib/daily-targets.ts`, because
// the chat pipeline needs the same target to answer "what should I have?" (item
// 22). There is no shared package across the Next/Expo boundary, so the rule is
// written twice - and this project has already had a three-way duplication drift
// while a comment claimed a parity test was keeping it honest. `npx tsx
// scripts/probe-target-parity.mjs` is that test, and it exists: 315 combinations,
// both implementations, fails on any disagreement. Change one, run it, change both.

export type FocusState = 'reduce' | 'maintain' | 'increase';
export type CalorieTargetMode = 'deficit' | 'maintenance' | 'surplus';

export type CalorieTarget = {
  targetKcal: number; // the daily target, rounded to the nearest 10
  mode: CalorieTargetMode;
  isRecomposition: boolean; // reduce fat + increase muscle → maintenance, framed as slow simultaneous change
  deltaKcal: number;
  /**
   * The floor, when it raised the figure; null when it did not bite.
   * The screen says so rather than showing a number with no basis.
   */
  flooredAt: number | null; // signed daily delta vs TDEE (negative deficit, positive surplus, 0 maintenance)
  /**
   * WHY THE FIGURE IS NOT WHAT HER GOAL IMPLIES, or null when it is.
   *
   * Without this a surface can only say WHAT the target is, so a target held at
   * maintenance during a pause is indistinguishable from "stay as I am" - and the
   * screen would either stay silent about a change she did not make, or re-derive
   * the reason itself. Re-deriving is how Ruth came to be shown two different
   * protein targets on 2 October: the panel decided from the goal's WISH while the
   * figures came from the sum. Every surface now reads the reason off the number.
   */
  heldBecause: 'training_paused' | 'deficit_paused' | null;
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

import { calorieFloor } from './body-intent';

const roundTo = (n: number, step: number): number => Math.round(n / step) * step;

// A FLOOR UNDER THE DEFICIT (2026-10-02).
//
// Ruth: "lose fat (moderate deficit with a floor)."
//
// There was no floor. The deficit is 0.5% of bodyweight a week, which for a
// small woman can land under what her body uses at rest - nothing in this
// function stopped it. At 56 kg and a BMR of 1,123 the figure comes out at about
// 1,430, which is fine; the same arithmetic at a lower TDEE is not, and the
// function had no opinion about where it stopped.
//
// THE HIGHER OF HER BMR AND 1,200, so neither is the loophole: BMR is what her
// body uses lying still, and 1,200 catches a BMR estimate that is itself
// implausibly low. The floor lives in lib/body-intent.ts so the figure and the
// sentence explaining it cannot disagree.
//
// `mode` STAYS 'deficit' WHEN THE FLOOR BITES. It is still a fat-loss intent and
// the UI should still frame it as one; what changed is the number, and
// `flooredAt` is how the screen knows to say so rather than show an unexplained
// figure. Silently clamping is the one outcome worse than either.
export function calculateCalorieTarget(params: {
  tdeeKcal: number | null | undefined;
  weightKg: number | null | undefined; // required only for the deficit branch
  /** Her BMR, for the floor under the deficit. Without it the floor is 1,200. */
  bmrKcal?: number | null;
  fatFocus: FocusState | null | undefined;
  muscleFocus: FocusState | null | undefined;
  /**
   * WHETHER THERE IS A TRAINING STIMULUS. Only 'paused' changes anything, and
   * what it changes is the SURPLUS: 150 kcal a day exists to feed muscle being
   * built, and with nothing asking for it the same 150 kcal is fat gain under a
   * label that says muscle. Null is not a pause - see lib/protein.ts.
   */
  training?: 'training' | 'paused' | null;
  /**
   * WHETHER SHE WANTS THE DEFICIT RUNNING RIGHT NOW (Ruth, 2 October 2026: "if
   * you go on holiday you may want to pause the deficit").
   *
   * A DIFFERENT PAUSE FROM THE ONE ABOVE, deliberately. A holiday is a reason to
   * stop eating under what she uses and no reason to stop training; an injury is
   * the reverse. Null and 'on' both mean running, because a deficit is what
   * choosing to lose fat already asked for.
   */
  deficitState?: 'on' | 'paused' | null;
}): CalorieTarget | null {
  const { tdeeKcal, weightKg, bmrKcal, fatFocus, muscleFocus } = params;
  const trainingPaused = params.training === 'paused';
  const deficitPaused = params.deficitState === 'paused';
  if (tdeeKcal == null || tdeeKcal <= 0) return null;

  // NOT STATED IS NOT MAINTENANCE (2026-09-28). Mirrors app/lib/daily-targets.ts,
  // where the full reasoning lives; probe-target-parity.mjs fails if the two
  // ever disagree, and it now covers the null cases too.
  if (fatFocus == null || muscleFocus == null) return null;

  // Surplus: either focus wants growth. Doesn't stack, doesn't need bodyweight.
  const wantsGrowth = fatFocus === 'increase' || (fatFocus === 'maintain' && muscleFocus === 'increase');
  if (wantsGrowth) {
    // A SURPLUS WITH NOTHING TO BUILD WITH IS JUST A SURPLUS. Held at what she
    // uses while training is paused, and it comes back when she starts again.
    if (trainingPaused) {
      return {
        targetKcal: roundTo(tdeeKcal, ROUND_TO),
        mode: 'maintenance',
        isRecomposition: false,
        deltaKcal: 0,
        flooredAt: null,
        heldBecause: 'training_paused',
      };
    }
    return {
      targetKcal: roundTo(tdeeKcal + SURPLUS_KCAL, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: SURPLUS_KCAL,
      flooredAt: null,
      heldBecause: null,
    };
  }

  // Deficit: fat-loss without a competing muscle-gain intent. Needs bodyweight.
  if (fatFocus === 'reduce' && muscleFocus !== 'increase') {
    // PAUSED FOR A HOLIDAY, AND STILL HER GOAL. Nothing is archived and the goal
    // screen is unchanged; she is simply not eating under what she uses this
    // week. Checked before the weight requirement, because a paused deficit
    // needs no bodyweight to work out - it is just maintenance.
    if (deficitPaused) {
      return {
        targetKcal: roundTo(tdeeKcal, ROUND_TO),
        mode: 'maintenance',
        isRecomposition: false,
        deltaKcal: 0,
        flooredAt: null,
        heldBecause: 'deficit_paused',
      };
    }
    if (weightKg == null || weightKg <= 0) return null;
    const dailyDeficit = Math.round((WEEKLY_LOSS_FRACTION * weightKg * KCAL_PER_KG) / 7);
    const floor = calorieFloor(bmrKcal);
    const wanted = roundTo(tdeeKcal - dailyDeficit, ROUND_TO);
    const floored = wanted < floor;
    return {
      targetKcal: floored ? roundTo(floor, ROUND_TO) : wanted,
      mode: 'deficit',
      isRecomposition: false,
      // THE DELTA STAYS TRUE TO THE FIGURE, not to the intention. A target
      // held at the floor is a smaller deficit than 0.5% a week asked for,
      // and reporting the larger one would misdescribe what she is eating.
      deltaKcal: floored ? roundTo(floor, ROUND_TO) - roundTo(tdeeKcal, ROUND_TO) : -dailyDeficit,
      flooredAt: floored ? roundTo(floor, ROUND_TO) : null,
      heldBecause: null,
    };
  }

  // Maintenance: everything else — pure maintenance, and recomposition
  // (fat=reduce + muscle=increase), which is maintenance with the flag set.
  return {
    targetKcal: roundTo(tdeeKcal, ROUND_TO),
    mode: 'maintenance',
    isRecomposition: fatFocus === 'reduce' && muscleFocus === 'increase',
    deltaKcal: 0,
    flooredAt: null,
    // RECOMPOSITION IS ALREADY MAINTENANCE, so a training pause changes no figure
    // here - but it changes what the figure MEANS, and the surfaces say so. The
    // protein is where a paused recomposition actually moves.
    heldBecause: trainingPaused && fatFocus === 'reduce' && muscleFocus === 'increase'
      ? 'training_paused'
      : null,
  };
}
