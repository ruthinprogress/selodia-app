// MOVEMENTS TO LEAVE OUT OF SESSIONS, AS TAPS.
//
// Ruth's approved preview, section 4 of "Anything to steer around?": four chips
// plus her own box. These are not allergies - a movement in the allergies table
// would be a food restriction named "overhead press" - so they write user_rules,
// which the rules gate reads before anything is built for her.
//
// EVERY CHIP CARRIES ITS OWN MATCH TERMS, AND THAT IS THE WHOLE POINT OF THIS
// FILE. The gate's enforcement layer filters `kind === 'never' &&
// matchTerms.length > 0`, so a rule stored with no terms is silently ignored by
// the code that removes exercises. She would tap "Overhead work", see it
// selected, and be given overhead presses.
//
// A LABEL IS NOT A MATCHER. "Impact, such as jumping" matches nothing in a
// session plan; "jump", "jumping", "plyometric", "box jump", "skipping" and
// "running" do. The chip is how she recognises the thing; the terms are how the
// gate finds it. Writing the label as the only term would have produced a rule
// that looked right in Plans and excluded nothing at all, which is the worst
// shape a safety feature can take.
//
// OVER-MATCHING IS THE SAFE DIRECTION and is chosen deliberately. "Overhead
// work" excludes an overhead press she might have been fine with; the reverse
// gives a shoulder she was told to protect a press over her head. She can always
// say in chat that something is fine.
//
// NOTHING HERE IS CLINICAL ADVICE. The chips name categories she can recognise.
// The app does not decide what her injury implies, and it never suggests she can
// resume something.

export type MovementRuleOption = {
  key: string;
  /** What she taps. */
  label: string;
  /** The phrase stored on the rule, which is what Plans shows her. */
  phrase: string;
  /**
   * The words the gate matches in a session. Lower case, specific, and
   * deliberately generous: see the header on why over-matching is the safe way
   * round for an exclusion.
   */
  matchTerms: string[];
};

export const MOVEMENT_RULES: MovementRuleOption[] = [
  {
    key: 'heavy_load',
    label: 'Heavy lifting at load',
    phrase: 'No heavy lifting at load',
    matchTerms: [
      'heavy',
      'deadlift',
      'barbell squat',
      'back squat',
      'front squat',
      'clean',
      'snatch',
      'one rep max',
      '1rm',
    ],
  },
  {
    key: 'impact',
    label: 'Impact, such as jumping',
    phrase: 'No impact work, such as jumping',
    matchTerms: [
      'jump',
      'jumping',
      'jump squat',
      'box jump',
      'plyometric',
      'plyo',
      'skipping',
      'burpee',
      'running',
      'sprint',
      'hop',
    ],
  },
  {
    key: 'overhead',
    label: 'Overhead work',
    phrase: 'No overhead work',
    matchTerms: [
      'overhead',
      'overhead press',
      'shoulder press',
      'military press',
      'push press',
      'handstand',
      'pull-up',
      'pull up',
      'snatch',
      'thruster',
    ],
  },
  {
    key: 'deep_knee',
    label: 'Deep knee bends',
    phrase: 'No deep knee bends',
    matchTerms: [
      'deep squat',
      'full squat',
      'pistol squat',
      'lunge',
      'split squat',
      'kneeling',
      'deep knee',
    ],
  },
];

export const MOVEMENT_RULE_BY_KEY: Record<string, MovementRuleOption> = Object.fromEntries(
  MOVEMENT_RULES.map((r) => [r.key, r])
);

/**
 * The leading refusal removed, so a typed sentence becomes a usable term.
 *
 * "No overhead pressing, my left shoulder" -> "overhead pressing, my left
 * shoulder". A poor matcher and an honest one, which is the same fallback
 * pending-save.ts uses for a rule that arrives from chat. The phrase she typed is
 * stored whole and shown to her; this is only what the gate looks for.
 */
export function termFromTypedRule(text: string): string {
  const stripped = text
    .toLowerCase()
    .replace(/^(no|not|never|avoid|skip|leave out)\b[:,\s]*/i, '')
    .trim();
  return stripped || text.toLowerCase();
}
