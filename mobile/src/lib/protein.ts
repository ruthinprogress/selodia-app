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

// ---------------------------------------------------------------------------
// WHY THIS TAKES AN OBJECT AND NOT FOUR POSITIONAL ARGUMENTS (2026-10-02)
//
// Ruth, with two screenshots taken a minute apart: "there are now two different
// protein targets". Today said 82-98 g. The goals screen said 101-123 g. Both
// were this function, on the same body, in the same minute.
//
//   Today:   (protein_target_g, 56.6, 27.6)        -> lean mass 41 kg x 2.0-2.4
//   Goals:   (null, 56.6, null, highProtein=true)  -> bodyweight  x 1.8-2.2
//
// TWO DIFFERENT BASES AND A MISSING FLAG, in opposite directions, so neither
// figure was the other one rounded. The goals screen knew her goal and not her
// body fat; every other surface knew her body fat and not her goal.
//
// THE SHAPE OF THE SIGNATURE CAUSED IT. `highProtein` was added this morning as
// a fourth positional argument with a default of `false`, for the one screen
// that needed it. A defaulted trailing boolean is invisible at the other four
// call sites: they kept compiling, kept returning a number, and silently meant
// "her goal does not ask for more protein" when nobody had asked the question.
// Compare `calculateCalorieTarget`, which takes her focus states themselves -
// nobody has ever forgotten to tell that one her goal, because it cannot be
// called without them.
//
// So the flag is gone. This takes her stored focus and derives the step-up
// itself, and the input is an object: a missing field is a type error at every
// call site rather than a default at one. THE RULE LIVES IN ONE PLACE AND EVERY
// SURFACE ASKS IT THE SAME QUESTION.
// ---------------------------------------------------------------------------

/** Her stored focus, as user_profile holds it. Kept local on purpose: this
 *  module is mirrored on the Next side, and a shared import would mean the
 *  mirror needs one too. check-weight-and-targets.mjs asserts the derivation
 *  below against BODY_INTENTS so the two cannot drift apart. */
export type ProteinFocus = 'reduce' | 'maintain' | 'increase';

/**
 * WHETHER SHE IS ACTUALLY TRAINING RIGHT NOW. Null means she has not said.
 *
 * Ruth: "The protein target (101-123g) assumes you're actively resistance
 * training to drive the recomp - without that stimulus, it's a maintenance-range
 * target in disguise."
 *
 * She is right, and it is the same fault as the rest of this file in a different
 * coat: a number that quietly assumes a fact nobody checked. The step-up to
 * 2.2-2.6 is earned by a training stimulus. Without one it is not a recomp
 * target, it is a maintenance target with a larger number on it.
 */
export type TrainingState = 'training' | 'paused';

export type ProteinTarget =
  | { kind: 'manual'; grams: number }
  | {
      kind: 'range';
      low: number;
      high: number;
      basis: 'lean_mass' | 'bodyweight';
      /**
       * Which way the goal moved the range, so a surface can say so in words.
       *
       *   'up'    - stepped up: the goal's mechanism IS protein, and she is not
       *             paused.
       *   'held'  - the goal asks for the step-up and training is paused, so the
       *             plain range is shown instead and it steps back up when she
       *             trains again. THIS IS NOT A LOWER TARGET, it is the
       *             maintenance one, which is where it belongs with no stimulus.
       *   'plain' - the goal does not ask for the step-up at all.
       */
      stepped: 'up' | 'held' | 'plain';
    };

export type ProteinInput = {
  /** A figure she set herself. Outranks everything below it. */
  manualG?: number | null;
  weightKg: number | null | undefined;
  bodyFatPct: number | null | undefined;
  /**
   * Her stored muscle focus. 'increase' is the whole of the step-up condition:
   * recomposition and muscle gain are exactly the two intents whose mechanism is
   * protein plus training rather than a calorie deficit, and they are exactly
   * the two with muscle: 'increase'.
   */
  muscleFocus?: ProteinFocus | null;
  /** Only 'paused' holds the step-up back. Null is not a pause - see below. */
  training?: TrainingState | null;
};

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

/**
 * WHICH WAY THE GOAL MOVES THE RANGE.
 *
 * PROTEIN GOES HIGHER WHEN THE GOAL NEEDS IT TO (2026-10-02).
 *
 * Ruth: "recomposition (around maintenance, higher protein)".
 *
 * Recomposition is the one intent whose whole mechanism is protein and training
 * rather than a calorie deficit - the calorie target IS maintenance, so if the
 * protein does not move, choosing it changes nothing at all about what the app
 * asks of her. That would have been another answer that buys a false sense of
 * being understood.
 *
 * ONE STEP UP, NOT A DIFFERENT FORMULA. 2.0-2.4 becomes 2.2-2.6 g per kg of lean
 * mass, and 1.6-2.0 becomes 1.8-2.2 on bodyweight. Both remain inside what the
 * evidence supports for an active woman over 40; this is the top of the same
 * range, not a new claim.
 *
 * A PAUSE RETURNS THE PLAIN RANGE, IT DOES NOT GO UNDER IT. Her instruction was
 * about the step-up, which a stimulus earns. It would be a different and wrong
 * reading to drop protein below maintenance in a pause: for anyone in a deficit,
 * protein matters MORE without training, not less, because it is what is left
 * protecting the muscle. So 'held' lands on 2.0-2.4 and stops there.
 *
 * NOT SAYING IS NOT A PAUSE. Null steps up, and the surface says out loud what it
 * assumed - which is the flag she asked for. Treating silence as a pause would
 * mean her chosen goal changed nothing until she answered a question she had not
 * been asked, and her Week is empty by her own instruction, so there is no data
 * here to read a pause out of.
 */
export function proteinStep(input: {
  muscleFocus?: ProteinFocus | null;
  training?: TrainingState | null;
}): 'up' | 'held' | 'plain' {
  if (input.muscleFocus !== 'increase') return 'plain';
  return input.training === 'paused' ? 'held' : 'up';
}

export function calculateProteinTarget(input: ProteinInput): ProteinTarget | null {
  const { manualG, weightKg, bodyFatPct } = input;

  if (manualG != null && manualG > 0) {
    // A MANUAL TARGET IS UNTOUCHED. She set it; no goal overrides a figure she
    // chose, and no pause lowers it either.
    return { kind: 'manual', grams: Math.round(manualG) };
  }

  const stepped = proteinStep(input);
  const high = stepped === 'up';

  const lbm = leanBodyMassKg(weightKg, bodyFatPct);
  if (lbm != null && lbm > 0) {
    return {
      kind: 'range',
      low: Math.round(lbm * (high ? 2.2 : 2.0)),
      high: Math.round(lbm * (high ? 2.6 : 2.4)),
      basis: 'lean_mass',
      stepped,
    };
  }

  if (weightKg != null && weightKg > 0) {
    return {
      kind: 'range',
      low: Math.round(weightKg * (high ? 1.8 : 1.6)),
      high: Math.round(weightKg * (high ? 2.2 : 2.0)),
      basis: 'bodyweight',
      stepped,
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

/**
 * The sentence that names what the number assumed, or null when there is nothing
 * to say. Her flag, in one line, at the point of the figure.
 *
 * WHY THIS IS NOT A DISCLAIMER. "Assumes you are training" under a number she
 * cannot change is a hedge. The same sentence next to a row she can set is the
 * app telling her which fact it used, and where to correct it.
 */
export function proteinAssumptionNote(target: ProteinTarget | null): string | null {
  if (target == null || target.kind !== 'range') return null;
  if (target.stepped === 'up') {
    return 'Kept high because that is what protects muscle, and it assumes you are training. Say so in your Body Manual if you are not, and it comes back down.';
  }
  if (target.stepped === 'held') {
    return 'Held at the maintenance range while your training is paused. It steps back up when you start again.';
  }
  return null;
}
