// WHAT BRINGS HER HERE, and what each answer actually changes.
//
// Ruth's session brief, 28 September 2026: onboarding is tap-based, about a
// minute, and "every answer must change something". That last clause is the
// design constraint, not a nicety - a question whose answer changes nothing is
// a question that costs a minute and buys a false sense of being understood.
// So each option below names its effect, and the effects are the reason the
// list is seven long rather than twenty.
//
// GOALS ARE WELCOME, SHAME IS NOT. No option is phrased as a deficit, none of
// them carries a number, and the optional measure that can be attached to fat
// or muscle is shown as one line and never counted down from.

/** The three states a focus can be in, or null for not stated. */
export type FocusState = 'reduce' | 'maintain' | 'increase';

export type GoalKey =
  | 'lose_fat'
  // HER OWN GOAL, AND IT WAS NOT ON THE LIST (2 October 2026). The arithmetic has
  // supported recomposition since August - fat reduce with muscle increase gives
  // a maintenance target flagged isRecomposition - but no single tap produced
  // that pair. She would have had to choose "Lose fat" AND "Build muscle" and
  // know the combination meant something. Her stated goal is the same weight
  // with less fat and more muscle, and the screen had no way to say it.
  | 'recomposition'
  | 'build_muscle'
  | 'learn_a_skill'
  | 'keep_steady'
  | 'more_energy'
  | 'menopause';

export type GoalOption = {
  key: GoalKey;
  /** What she taps, and what then appears on Plans. */
  label: string;
  /** What this answer changes. Shown to nobody; it is here to be checkable. */
  effect: string;
  fat: FocusState | null;
  muscle: FocusState | null;
  /** Whether "got a number or measure in mind?" is offered after this one. */
  invitesMeasure?: boolean;
  /** Whether choosing it opens the skill question (brief, screen 2). */
  opensSkills?: boolean;
};

// GET STRONGER IS NOT IN THIS LIST (Ruth, 4 October 2026): "Get rid of Get
// Stronger entirely, there should be a 'Feel Stronger' in 'How do you want your
// days to feel'." There already is - FEEL_CHIPS has carried "Feel stronger"
// since the feel goals were built, so nothing needed adding.
//
// IT WAS ALSO QUIETLY SETTING A CALORIE SURPLUS. It wrote muscle: 'increase',
// identical to Build muscle, so ticking a training aspiration added calories to
// somebody's daily figure without saying so. Its own comment argued the calorie
// consequence was "the same direction" - which was the reasoning, and the
// reasoning was the fault: getting stronger is about what you can do, and this
// list is only for the calorie and body-composition calls.
//
// A stored goal_key of 'get_stronger' from before today simply stops matching a
// chip, which the goals screen already handles - it filters to known keys.
export const GOAL_OPTIONS: GoalOption[] = [
  {
    key: 'lose_fat',
    label: 'Lose fat',
    effect: 'Fat focus becomes reduce, so the calorie target becomes a gentle deficit.',
    fat: 'reduce',
    muscle: null,
    invitesMeasure: true,
  },
  {
    key: 'recomposition',
    // Her words for it, from the brief: "same weight, less fat, more muscle".
    // Not "recomposition", which is a term rather than an outcome.
    label: 'Less fat, more muscle',
    effect:
      'Fat reduce with muscle increase: a maintenance target, with protein at the top of the range.',
    fat: 'reduce',
    muscle: 'increase',
    invitesMeasure: true,
  },
  {
    key: 'build_muscle',
    label: 'Build muscle',
    effect: 'Muscle focus becomes increase: a small surplus, and protein scales up.',
    fat: null,
    muscle: 'increase',
    invitesMeasure: true,
  },
  {
    key: 'learn_a_skill',
    label: 'Learn a skill',
    effect: 'Opens the skill question, and seeds the first Now and Next in Skills.',
    fat: null,
    muscle: null,
    opensSkills: true,
  },
  {
    key: 'keep_steady',
    label: 'Keep things steady',
    // THE ONLY OPTION THAT WRITES 'maintain', and that is the whole point of
    // this file. Maintenance used to be what everybody got by accident, from a
    // NOT NULL DEFAULT on the column. Now it is something a person can choose
    // and nothing else produces it.
    effect: 'Both focuses become maintain. A maintenance target, chosen rather than inherited.',
    fat: 'maintain',
    muscle: 'maintain',
  },
  {
    key: 'more_energy',
    label: 'More energy',
    effect: 'No calorie change. Sleep and how she felt are read against it in the roundup.',
    fat: null,
    muscle: null,
  },
  {
    key: 'menopause',
    label: 'Perimenopause or menopause',
    effect: 'Opens the life-stage question, and strength work is offered as a reason.',
    fat: null,
    muscle: null,
  },
];

export const GOAL_BY_KEY: Record<GoalKey, GoalOption> = Object.fromEntries(
  GOAL_OPTIONS.map((g) => [g.key, g])
) as Record<GoalKey, GoalOption>;

/**
 * The focus states a set of chosen goals implies.
 *
 * THE RULE FOR SILENCE, because it is the thing this whole slice is about.
 * A focus that no chosen goal speaks to stays null, and null means "not
 * stated" - the target code reads it as no target rather than a maintenance
 * one. The one exception is deliberate: once she HAS chosen something,
 * the other focus resolves to 'maintain', because "lose fat" said nothing
 * about muscle on purpose. That is a consequence of a choice she made, not a
 * default over silence, and the two are different things.
 *
 * Choosing nothing at all leaves both null and she gets no calorie target,
 * which is the honest outcome.
 */
export function focusFromGoals(keys: GoalKey[]): {
  fat: FocusState | null;
  muscle: FocusState | null;
} {
  if (keys.length === 0) return { fat: null, muscle: null };

  let fat: FocusState | null = null;
  let muscle: FocusState | null = null;
  let spoke = false;

  for (const key of keys) {
    const option = GOAL_BY_KEY[key];
    if (!option) continue;
    // 'increase' and 'reduce' are both stronger than 'maintain', so a person
    // who picks "keep things steady" AND "lose fat" gets the deficit. She
    // asked for both; the specific one is the one she meant.
    if (option.fat && (fat === null || fat === 'maintain')) fat = option.fat;
    if (option.muscle && (muscle === null || muscle === 'maintain')) muscle = option.muscle;
    if (option.fat || option.muscle) spoke = true;
  }

  if (spoke) {
    fat = fat ?? 'maintain';
    muscle = muscle ?? 'maintain';
  }
  return { fat, muscle };
}

/** The optional measure is offered only after a goal that can carry one. */
export function invitesMeasure(keys: GoalKey[]): boolean {
  return keys.some((k) => GOAL_BY_KEY[k]?.invitesMeasure);
}

export function opensSkills(keys: GoalKey[]): boolean {
  return keys.some((k) => GOAL_BY_KEY[k]?.opensSkills);
}
