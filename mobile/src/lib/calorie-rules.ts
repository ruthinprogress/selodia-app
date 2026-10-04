// EVERY NUMBER IN THE CALORIE ENGINE, WITH WHY IT IS THAT NUMBER AND WHEN IT WAS
// LAST LOOKED AT (Ruth's final rules, 4 October 2026, item 3).
//
//   "Every rule in the machine-readable matrix carries a 'basis' (the evidence)
//   and a 'last reviewed' date; the checks read the matrix so the code cannot
//   drift from it."
//
// WHY THIS FILE AND NOT A COMMENT. Comments have been the problem rather than the
// record all week: a comment claiming a scope the code did not have sat above a
// delete for days, and a matrix typed by hand describes what somebody believed on
// the day they wrote it. These constants are exported and USED by the engine, so
// a rule that changes without its basis and date changing fails the check - the
// evidence and the arithmetic cannot drift apart because they are the same object.
//
// WHAT "BASIS" IS FOR. The monthly research scan proposes changes against these
// entries: it reads the basis, looks for newer primary sources, and drafts an
// update with its own evidence. It never applies one. A number nobody can say the
// reason for is a number nobody can safely revise.
//
// HONEST ABOUT CONFIDENCE. Several of these are reasonable positions rather than
// settled findings, and the basis says which is which. "Start at 5% and refine
// with her own data" is a starting point, stated as one.

export type CalorieRule = {
  key: string;
  /** The rule in one line, as it behaves. */
  rule: string;
  /** The value the engine actually uses. */
  value: string;
  /** What it rests on. Plain, and honest about how firm it is. */
  basis: string;
  /** ISO date. The monthly scan updates this when a rule is reviewed. */
  lastReviewed: string;
};

/** 4 October 2026: the day these were set with Ruth, and the first review date. */
const SET = '2026-10-04';

export const CALORIE_RULES: CalorieRule[] = [
  {
    key: 'deficit_rate',
    rule: 'Losing fat takes about 0.5% of bodyweight a week off what she uses.',
    value: '0.5% per week',
    basis:
      'The slow end of the commonly cited 0.5-1% per week. The slower rate is chosen because it is the one that preserves lean mass, which is the whole point for a woman over forty - a faster deficit costs muscle she is simultaneously trying to keep.',
    lastReviewed: SET,
  },
  {
    key: 'deficit_floor',
    rule: 'The deficit never goes below the higher of her BMR and 1,200 kcal.',
    value: 'max(BMR, 1200)',
    basis:
      '1,200 is the conventional absolute minimum for an adult woman, and BMR is what her body uses lying still - eating under it as a standing arrangement is a different thing from a gentle deficit. The higher of the two, so neither can be the loophole.',
    lastReviewed: SET,
  },
  {
    key: 'energy_per_kg',
    rule: 'One kilo of body mass is treated as 7,700 kcal.',
    value: '7,700 kcal/kg',
    basis:
      'The standard figure, and deliberately the SAME constant for losing and for gaining. It is an approximation in both directions - tissue gained is not identical to tissue lost - and using one number keeps the two rates comparable instead of making a difference that the evidence does not support.',
    lastReviewed: SET,
  },
  {
    key: 'recomposition',
    rule: 'Losing fat while building muscle eats around what she uses, not under it.',
    value: 'maintenance',
    basis:
      'Recomposition is driven by the protein and the training rather than by a deficit. A deficit on top would compete with the muscle side, which is the thing she is least able to afford to lose.',
    lastReviewed: SET,
  },
  {
    key: 'build_surplus',
    rule: 'Building muscle, with nothing said about weight, adds 5% of what she uses.',
    value: '5% of TDEE (78 kcal at TDEE 1,551)',
    basis:
      'A STARTING POINT, not a settled figure, and Ruth set it as one: "start at 5% of TDEE; refine with user data later". Low on purpose, because fat is easier to gain than muscle at this stage of life and the cost of being slightly under is slower progress rather than fat gained. A percentage of what she burns rather than of what she weighs, because what building costs tracks the former.',
    lastReviewed: SET,
  },
  {
    key: 'build_surplus_not_when_maintaining',
    rule: 'The build surplus does not apply when she has said Maintain weight.',
    value: 'no surplus',
    basis:
      'She said not to move her weight. Overriding that would be the app arguing with the switch she just pressed - the same fault as "Get stronger" silently adding calories.',
    lastReviewed: SET,
  },
  {
    key: 'gain_rate',
    rule: 'Gaining weight adds about 0.25% of bodyweight a week.',
    value: '0.25% per week (156 kcal at 56.55 kg)',
    basis:
      'Half the fat-loss rate, which is the right order: muscle is laid down more slowly than fat is lost, and a faster surplus is mostly fat and harder to keep. Scaled to bodyweight because gaining weight is about the body being added to.',
    lastReviewed: SET,
  },
  {
    key: 'gain_bounds',
    rule: 'The gain surplus is never below 100 kcal a day, nor above 300.',
    value: 'floor 100, ceiling 300',
    basis:
      'The ceiling binds above about 109 kg and exists so that scaling can never become a reason the number keeps growing. The floor binds below about 36 kg and exists so the surplus stays large enough to do anything at all. Both are stated rather than implied, because an unbounded rule is one nobody can check.',
    lastReviewed: SET,
  },
  {
    key: 'pause',
    rule: 'Pause puts every combination at what her body uses, with protein at the maintenance range.',
    value: 'TDEE, maintenance protein',
    basis:
      'One rule for every state, so it cannot mean different things on different screens. Her switches are untouched, so Resume restores them exactly and nothing is lost by taking a week off.',
    lastReviewed: SET,
  },
  {
    key: 'protein_lean',
    rule: 'Protein is 2.0-2.4 g per kg of lean mass, or 2.2-2.6 when building muscle.',
    value: '2.0-2.4 / 2.2-2.6 g per kg LBM',
    basis:
      'Within the range supported for an active woman over forty; the higher band is the top of the same range rather than a new claim. Lean mass rather than bodyweight wherever a body fat reading exists, because muscle_kg is not a standardised field across scale manufacturers.',
    lastReviewed: SET,
  },
  {
    key: 'activity_level',
    rule: 'The activity multiplier covers the whole week INCLUDING her usual training.',
    value: '1.2 to 1.9 on BMR',
    basis:
      'The standard Harris-Benedict style multipliers, which assume the whole day. The question used to ask about movement OUTSIDE exercise and feed the answer to a whole-day multiplier, which left her training out of her own estimate - about 400 kcal a day in her case.',
    lastReviewed: SET,
  },
];

export const RULE_BY_KEY: Record<string, CalorieRule> = Object.fromEntries(
  CALORIE_RULES.map((r) => [r.key, r])
);
