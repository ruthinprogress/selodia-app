// WHAT SHE WANTS HER BODY TO DO, AND HOW THAT BECOMES A NUMBER.
//
// Ruth, 2 October 2026: "Support four intents: lose fat (moderate deficit with a
// floor), recomposition (around maintenance, higher protein), build muscle
// (small surplus), stay as I am. Show her the figures and how they were worked
// out before saving."
//
// RECOMPOSITION WAS NOT REACHABLE, AND IT IS HER OWN GOAL. The arithmetic has
// supported it since August - fat reduce with muscle increase returns a
// maintenance target flagged isRecomposition - but no tap produced that pair.
// She would have had to choose "Lose fat" AND "Build muscle" and know that the
// combination meant something. Her stated goal is the same weight with less fat
// and more muscle, and there was no way to say it.
//
// A FLOOR ON THE DEFICIT, which there was not. The deficit is 0.5% of bodyweight
// a week, and for a small woman that can land under what she needs to function:
// nothing stopped the figure going below her own BMR. The floor is the higher of
// her BMR and 1200, and when it bites she is told the figure was raised and why,
// because a target quietly clamped is a target whose basis she cannot see.
//
// THE EXPLANATION IS NOT DECORATION. "Show her the figures and how they were
// worked out BEFORE saving" is the requirement, and the reason is the one that
// runs through this whole app: a number with no visible basis is something to be
// obeyed or failed, and a number she watched being built is a tool. It also
// catches a wrong input - a weight typed in pounds into a kg box shows up
// immediately as a strange BMR, which no amount of validation would have caught
// as reliably as her reading it.
//
// NO TARGET WEIGHT AND NO DEADLINE, anywhere in this file. Her instruction, and
// the reason there is no "by when" and no goal figure in any of the lines below.

export type FocusState = 'reduce' | 'maintain' | 'increase';

export type BodyIntentKey = 'lose_fat' | 'recomposition' | 'build_muscle' | 'stay_as_i_am';

export type BodyIntent = {
  key: BodyIntentKey;
  /** What she taps. */
  label: string;
  /** The one line under it, in plain words. No numbers, no shame. */
  note: string;
  fat: FocusState;
  muscle: FocusState;
  /** Recomposition and muscle gain both want protein at the top of the range. */
  highProtein: boolean;
};

export const BODY_INTENTS: BodyIntent[] = [
  {
    key: 'lose_fat',
    label: 'Lose fat',
    note: 'A gentle deficit, with a floor it will not go under.',
    fat: 'reduce',
    muscle: 'maintain',
    highProtein: false,
  },
  {
    key: 'recomposition',
    label: 'Less fat, more muscle',
    // HER OWN WORDS FOR IT, from the brief: "same weight, less fat, more
    // muscle". The label avoids "recomposition" because the screen is read by
    // somebody who wants an outcome, not a term.
    note: 'About the same weight, with the shape changing. Eating around what you use, protein high.',
    fat: 'reduce',
    muscle: 'increase',
    highProtein: true,
  },
  {
    key: 'build_muscle',
    label: 'Build muscle',
    note: 'A small surplus, and protein high.',
    fat: 'maintain',
    muscle: 'increase',
    highProtein: true,
  },
  {
    key: 'stay_as_i_am',
    label: 'Stay as I am',
    note: 'Eating around what you use. A choice, not a default.',
    fat: 'maintain',
    muscle: 'maintain',
    highProtein: false,
  },
];

export const BODY_INTENT_BY_KEY: Record<BodyIntentKey, BodyIntent> = Object.fromEntries(
  BODY_INTENTS.map((i) => [i.key, i])
) as Record<BodyIntentKey, BodyIntent>;

/** Which intent a stored focus pair means, or null when nothing was stated. */
export function intentFromFocus(
  fat: FocusState | null | undefined,
  muscle: FocusState | null | undefined
): BodyIntent | null {
  if (!fat || !muscle) return null;
  return BODY_INTENTS.find((i) => i.fat === fat && i.muscle === muscle) ?? null;
}

// ---------------------------------------------------------------- the floor

/**
 * THE LOWEST A CALORIE TARGET MAY GO.
 *
 * Her BMR is what her body uses lying still; eating under it as a standing
 * arrangement is not a gentler version of a deficit, it is a different thing.
 * 1200 is the conventional absolute minimum for an adult woman and catches the
 * case where a BMR estimate itself comes out implausibly low.
 *
 * THE HIGHER OF THE TWO, so neither can be the loophole.
 */
export const ABSOLUTE_FLOOR_KCAL = 1200;

export function calorieFloor(bmrKcal: number | null | undefined): number {
  const bmr = typeof bmrKcal === 'number' && bmrKcal > 0 ? Math.round(bmrKcal) : 0;
  return Math.max(bmr, ABSOLUTE_FLOOR_KCAL);
}

// ------------------------------------------------------- what she is shown

export type TargetWorking = {
  /** One line each, in the order they were worked out. */
  lines: string[];
  /** The figure itself, or null when something needed is missing. */
  targetKcal: number | null;
  /** What is still needed, when there is no figure. One short sentence. */
  missing: string | null;
  /** True when the floor raised the figure, so the screen can say so. */
  flooredAt: number | null;
};

const kcal = (n: number) => `${n.toLocaleString('en-GB')} kcal`;

/**
 * The figures and how they were reached, for showing her before anything saves.
 *
 * EVERY LINE IS SOMETHING SHE CAN CHECK. The weight she gave, the height she
 * gave, how active she said she is, the arithmetic, and the adjustment her goal
 * makes. Nothing in here is rounded for presentation beyond the nearest ten,
 * which is the precision the estimate actually has.
 */
export function explainTarget(input: {
  intent: BodyIntent;
  weightKg: number | null | undefined;
  weightSource: 'estimate' | 'measured' | null | undefined;
  bmrKcal: number | null | undefined;
  tdeeKcal: number | null | undefined;
  activityWord: string | null | undefined;
  proteinLow: number | null | undefined;
  proteinHigh: number | null | undefined;
}): TargetWorking {
  const { intent, weightKg, weightSource, bmrKcal, tdeeKcal, activityWord } = input;
  const lines: string[] = [];

  if (weightKg == null || weightKg <= 0) {
    return {
      lines: [],
      targetKcal: null,
      missing: 'Add your weight to see your targets.',
      flooredAt: null,
    };
  }

  lines.push(
    weightSource === 'estimate'
      ? `Weight: about ${weightKg} kg, as you said. A guess is fine here.`
      : `Weight: ${weightKg} kg, from your last weigh-in.`
  );

  if (bmrKcal == null || bmrKcal <= 0 || tdeeKcal == null || tdeeKcal <= 0) {
    return {
      lines,
      targetKcal: null,
      // Height is the other input BMR cannot do without, and the activities
      // screen is where it is asked.
      missing: 'Your height is needed as well, to work out the rest.',
      flooredAt: null,
    };
  }

  const bmr = Math.round(bmrKcal);
  const tdee = Math.round(tdeeKcal);
  lines.push(`At rest your body uses about ${kcal(bmr)} a day.`);
  lines.push(
    activityWord
      ? `With your days being ${activityWord}, that comes to about ${kcal(tdee)} used altogether.`
      : `Altogether that comes to about ${kcal(tdee)} a day.`
  );

  const floor = calorieFloor(bmr);
  let target = tdee;
  let flooredAt: number | null = null;

  if (intent.key === 'lose_fat') {
    // 0.5% of bodyweight a week, at 7,700 kcal per kg, spread over seven days.
    const daily = Math.round((0.005 * weightKg * 7700) / 7);
    lines.push(
      `Losing fat gently is about half a percent of your weight a week, which works out as ${kcal(
        daily
      )} a day less than you use.`
    );
    target = tdee - daily;
    if (target < floor) {
      flooredAt = floor;
      lines.push(
        `That would come to ${kcal(target)}, which is below what your body uses at rest, so it is held at ${kcal(
          floor
        )} instead.`
      );
      target = floor;
    }
  } else if (intent.key === 'build_muscle') {
    lines.push(`Building muscle wants a small surplus, so 150 kcal a day more than you use.`);
    target = tdee + 150;
  } else if (intent.key === 'recomposition') {
    lines.push(
      `Less fat with more muscle means eating around what you use rather than under it. The change comes from the protein and the training, not from a deficit.`
    );
  } else {
    lines.push(`Staying as you are means eating around what you use.`);
  }

  const rounded = Math.round(target / 10) * 10;
  lines.push(`So: about ${kcal(rounded)} a day.`);

  const { proteinLow, proteinHigh } = input;
  if (proteinLow != null && proteinHigh != null && proteinLow > 0) {
    lines.push(
      intent.highProtein
        ? `Protein ${proteinLow} to ${proteinHigh} g a day, kept high because that is what protects muscle.`
        : `Protein ${proteinLow} to ${proteinHigh} g a day.`
    );
  }

  // SAID ONCE, AND NOT AS A DISCLAIMER. These are estimates from a formula, and
  // she should know that without being told to distrust them.
  lines.push(`These are estimates, and they move as anything else does. Nothing here has a date on it.`);

  return { lines, targetKcal: rounded, missing: null, flooredAt };
}
