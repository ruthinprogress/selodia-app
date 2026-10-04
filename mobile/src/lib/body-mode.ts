import type { FocusState } from '@/lib/body-intent';

// TWO SWITCHES, NOT EIGHT CHIPS (Ruth, 4 October 2026).
//
//   "What if this all lives on today and can be easily switched on and off by
//   the user as weeks pass by and life happens... Two Toggles on the Today
//   screen, each with a hideable explanation: Lose fat mode. Build muscle mode."
//
// And then, looking at the onboarding screen: "it might be the simplification we
// needed that was confusing the onboarding too. What is selected in onboarding
// goes directly into the today screen and is clear. Because right now it's
// showing a set of options that actually were already decided should not be
// together."
//
// SHE IS DESCRIBING THE MODEL THE APP ALREADY HAS. There have always been exactly
// four body states, built from two stored columns. The goals screen offered them
// as eight chips, four of which were values of ONE question presented as four
// independent checkboxes:
//
//     Lose fat                fat: reduce
//     Less fat, more muscle   fat: reduce, muscle: increase
//     Build muscle            muscle: increase
//     Keep things steady      fat: maintain, muscle: maintain
//
// So the combination was offered alongside its own parts. Ticking "Lose fat" and
// "Build muscle" stores precisely what "Less fat, more muscle" stores on its own
// - three tap paths to one outcome, with nothing on screen saying so. That is
// what she hit: she picked "Lose fat", got a maintenance target, and went looking
// for a deficit control that was correctly hidden because she had no deficit.
//
// THE TWO BOOLEANS ARE A BIJECTION ONTO THE FOUR INTENTS, which is why this is a
// change of interface and not of arithmetic. Nothing new is computed and nothing
// is migrated; the same two columns are written, by a control that cannot express
// a contradiction. check-body-mode.mjs asserts the round trip both ways.
//
//     loseFat  buildMuscle   stored            what it is called
//     false    false         maintain/maintain  Maintaining my weight
//     true     false         reduce/maintain    Losing fat
//     false    true          maintain/increase  Building muscle
//     true     true          reduce/increase    Less fat, more muscle
//
// THE TWO RETIRED CHIPS WERE NEVER SEPARATE ANSWERS. "Less fat, more muscle" is
// both switches on; "Keep things steady" is both off. They become results rather
// than options, which is the whole of the simplification.

export type BodyMode = {
  /** Eat under what you use. */
  loseFat: boolean;
  /** Eat a little over it, with protein at the top of its range. */
  buildMuscle: boolean;
};

export const NO_MODE: BodyMode = { loseFat: false, buildMuscle: false };

/** What the two switches store. The only writer of these two columns. */
export function focusFromMode(mode: BodyMode): { fat: FocusState; muscle: FocusState } {
  return {
    fat: mode.loseFat ? 'reduce' : 'maintain',
    muscle: mode.buildMuscle ? 'increase' : 'maintain',
  };
}

/**
 * What the stored columns mean as switches.
 *
 * NULL IS NOT "BOTH OFF". A person who has never answered has no mode at all,
 * and showing her two switches both reading "off" would be the app answering for
 * her - the same silence-wearing-a-choice's-clothes that `asFocus` was fixed for
 * on 28 September. The caller decides what to draw for null.
 */
export function modeFromFocus(
  fat: FocusState | null | undefined,
  muscle: FocusState | null | undefined
): BodyMode | null {
  if (!fat || !muscle) return null;
  return { loseFat: fat === 'reduce', buildMuscle: muscle === 'increase' };
}

/** The one line naming where she is. Her own words for each, kept from the chips. */
export function modeLabel(mode: BodyMode | null): string {
  if (!mode) return 'Not set';
  if (mode.loseFat && mode.buildMuscle) return 'Less fat, more muscle';
  if (mode.loseFat) return 'Losing fat';
  if (mode.buildMuscle) return 'Building muscle';
  return 'Maintaining my weight';
}

/**
 * What the combination actually does, in the second person.
 *
 * BOTH ON IS NOT THE TWO EXPLANATIONS STACKED, and this is the one piece of real
 * design in the change. Read as independent switches, both on implies a deficit
 * AND a surplus, which is incoherent. It is maintenance calories with protein at
 * the top of its range - a different thing from either switch alone, and it has
 * to say so in its own words or the toggles are clearer than the chips about the
 * controls and worse about the result.
 *
 * SCREENS ARE IMPERSONAL. No "Selodía will"; the app does not narrate itself to
 * her on a screen.
 */
export function modeExplanation(mode: BodyMode | null): string {
  if (!mode) return 'Nothing is set yet, so there is no calorie target.';
  if (mode.loseFat && mode.buildMuscle) {
    return 'Your calorie target sits around what you use, not under it, and protein goes to the top of its range. The change comes from the protein and the training rather than from eating less. It is the slowest of the three and the one that keeps the most muscle.';
  }
  if (mode.loseFat) {
    return 'Your daily calorie target drops below what you use, gently - about half a percent of your weight a week - with a floor it will never go under. Protein stays high, because that is what protects muscle while you lose fat.';
  }
  if (mode.buildMuscle) {
    return 'Your daily calorie target rises a little above what you use, to fuel training, and protein moves to the top of its range for recovery and new muscle.';
  }
  return 'Your calorie target is simply what you use. A choice, not a default - and the right one when you want to hold steady.';
}

/** The training switch, which is a fact about her life rather than a target. */
export const TRAINING_EXPLANATION =
  'Protein goes to the top of its range while you are training, because that is what the extra is for, and building muscle only adds calories when there is training to feed. Pause it for a holiday, an injury, or any stretch where life gets in the way - nothing is lost, your goal does not change, and it all comes back when you start again.';

/** The heading on the training switch: what pressing it would do. */
export function trainingToggleLabel(paused: boolean): string {
  return paused ? 'Restart training' : 'Pause training';
}
