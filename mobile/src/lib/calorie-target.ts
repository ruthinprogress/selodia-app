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
  heldBecause: 'training_paused' | 'deficit_paused' | 'paused' | null;
};

// Energy in one kg of body mass (standard ~7700 kcal/kg), for turning the
// weekly weight-loss rate into a daily kcal deficit.
const KCAL_PER_KG = 7700;
// Default fat-loss rate: 0.5% of bodyweight per week — the evidence-grounded
// slow rate that preserves strength/lean mass (Part Eight; Resources).
const WEEKLY_LOSS_FRACTION = 0.005;
// Gentle-end surplus for lean gain (the spec's preferred end of 150–200).

// Targets round to a clean number.
const ROUND_TO = 10;

import { BUILD_SURPLUS_FRACTION, calorieFloor, gainSurplusKcal } from './body-intent';

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
  /** Her one Pause. True puts every combination at what her body uses. */
  paused?: boolean;
  /**
   * Whether she stated a weight direction at all.
   *
   * THE WHOLE OF THE BUILD-ALONE DISTINCTION. "Build muscle" with nothing said
   * about weight gets the small surplus that building needs; "Maintain weight"
   * with it does not, because she said so. The two store the same focus pair, so
   * the focus pair cannot carry this - see user_profile.body_mode.
   */
  weightDirectionStated?: boolean;
}): CalorieTarget | null {
  const { tdeeKcal, weightKg, bmrKcal, fatFocus, muscleFocus } = params;
  const paused = params.paused === true;
  const weightStated = params.weightDirectionStated !== false;
  const trainingPaused = params.training === 'paused';
  const deficitPaused = params.deficitState === 'paused';
  if (tdeeKcal == null || tdeeKcal <= 0) return null;

  // ONE PAUSE, AND IT LIVES HERE (Ruth's matrix reply, 4 October 2026).
  //
  //   "ONE quick Pause: a single tap puts her at maintenance (calories = her
  //   TDEE, protein = the maintenance range) without changing her toggles."
  //
  // It is checked FIRST and returns before any focus is read, because that is
  // what makes it one rule rather than a variant of each: every combination
  // pauses to exactly the same place, and no branch below can disagree with it.
  //
  // IT BELONGS IN THE FUNCTION THAT MAKES THE NUMBER, not in each surface that
  // shows one. Today, Drives, the day sums and the chat context all call this;
  // a pause applied in the UI would be a pause four places have to remember,
  // which is the shape of every figure that has disagreed with itself in this
  // app - two protein targets, two weights, a stale goal.
  //
  // HER TOGGLES ARE UNTOUCHED. Nothing is written when she pauses, so Resume is
  // simply this flag going false and every figure returning exactly as it was.
  if (paused) {
    return {
      targetKcal: roundTo(tdeeKcal, ROUND_TO),
      mode: 'maintenance',
      isRecomposition: false,
      deltaKcal: 0,
      flooredAt: null,
      heldBecause: 'paused',
    };
  }


  // NOT STATED IS NOT MAINTENANCE (2026-09-28). Mirrors app/lib/daily-targets.ts,
  // where the full reasoning lives; probe-target-parity.mjs fails if the two
  // ever disagree, and it now covers the null cases too.
  if (fatFocus == null || muscleFocus == null) return null;

  // Surplus: either focus wants growth. Doesn't stack, doesn't need bodyweight.
// A SURPLUS ONLY WHEN SHE HAS ASKED TO GAIN WEIGHT (Ruth's decision, 4 October
// 2026, option A).
//
//   "Build muscle never adds calories on its own; calories rise only when Gain
//   weight is on. Build alone, Maintain+Build and Lose+Build sit at what she
//   uses with protein at the top of its range; Gain and Gain+Build use the
//   bodyweight-scaled surplus."
//
// WHAT THIS FIXES. `wantsGrowth` used to include fat:maintain + muscle:increase,
// so turning on Build muscle added 150 kcal a day - and turning on BOTH "Maintain
// weight" and "Build muscle" still added them, which is the app contradicting the
// switch she had just pressed. It is the general form of the "Get stronger" fault
// she found the same evening: a control that silently moved her calories.
//
// Building muscle at the weight she is now is recomposition, which is a real and
// extremely common goal for a woman over forty. It does not need extra calories;
// it needs the protein, which it still gets.
//
// THE RATE IS SCALED AND CAPPED. A flat 150 is a different thing at 50 kg and at
// 100 kg. 0.25% of bodyweight a week is half the fat-loss rate, which is the
// right order for gaining - and the ceiling is there because the scaling must
// never become a reason the number grows without limit.
  const wantsGrowth = fatFocus === 'increase';
  if (wantsGrowth) {
    // A PAUSE TAKES BACK THE MUSCLE SURPLUS, NEVER THE WEIGHT-GAIN ONE
    // (4 October 2026, found by writing the matrix out).
    //
    // The 150 kcal has two different reasons behind it depending on who asked
    // for it, and only one of them is about training:
    //
    //   Build muscle          the surplus feeds training. No training, no reason.
    //   Gain weight           the surplus IS the goal. Training is beside the point.
    //
    // Treating them the same meant somebody who had said "I want to gain weight"
    // and "my training is paused" had her calorie target quietly cut by 150 a
    // day - for an injury, a holiday, or any stretch where life got in the way.
    // That is the opposite of what the gain-weight mode is for, and it is the
    // one place in this app where taking calories away without being asked could
    // do real harm. Ruth's requirements for it are explicit: a capped, gentle
    // surplus and no pressure, with recovery handled as a clinician's business
    // rather than this app's.
    //
    // So the pause only applies where the surplus was earned by training.
    // SCALED, SO IT NEEDS A WEIGHT - exactly as the deficit does. Without one
    // there is no honest figure to give, and inventing a flat number for
    // somebody whose weight is unknown is how a gentle rate stops being gentle.
    if (weightKg == null || weightKg <= 0) return null;
    const surplus = gainSurplusKcal(weightKg);
    return {
      targetKcal: roundTo(tdeeKcal + surplus, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: surplus,
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
  // BUILD MUSCLE WITH NOTHING SAID ABOUT WEIGHT (Ruth's final rules, 4 October
  // 2026): "a SMALL SURPLUS, a percentage of what she uses, on the low side
  // because fat is easier to gain at this stage of life: start at 5% of TDEE."
  //
  // A PERCENTAGE OF TDEE, NOT OF BODYWEIGHT, and the difference is deliberate:
  // what building costs tracks what she already burns, not what she weighs. The
  // gain-weight surplus is the other way round because gaining weight is about
  // the body being added to.
  //
  // IT DOES NOT APPLY WHEN SHE SAID MAINTAIN. That is the same switch saying
  // "do not move my weight", and overriding it would be the app arguing.
  if (muscleFocus === 'increase' && fatFocus === 'maintain' && !weightStated) {
    const surplus = Math.round(tdeeKcal * BUILD_SURPLUS_FRACTION);
    return {
      targetKcal: roundTo(tdeeKcal + surplus, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: surplus,
      flooredAt: null,
      heldBecause: null,
    };
  }

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
