// Unsafe-goal handling. Build item 43, and Part Twelve's Cross-Cutting Safety
// Principle.
//
// WHAT IT DOES, per the spec: when a stated goal calculates into an unsafe range,
// flag it clearly and kindly at the point it is stated, stop precise numeric
// coaching built on that goal, and offer a resource ONCE without repeating it
// unprompted. It never hard-blocks and never freezes the app - logging stays
// completely available, because someone whose goal is worrying still needs to be
// able to record what they ate, and taking that away would punish them for saying
// something true.
//
// THE MODEL REPORTS THE NUMBER; THIS FILE JUDGES IT. That split is the whole
// design. Asking a model "is this goal unsafe?" is a prompt instruction, which a
// long session can truncate and a determined conversation can talk around - the
// same weakness the allergy gate exists to cover. Asking it "what weight did they
// say?" is extraction, which is what models are reliable at, and the arithmetic
// afterwards is arithmetic.
//
// WHAT DOES NOT EXIST YET, recorded so it is not assumed: `fat_focus_target_value`
// is in the schema but nothing reads or writes it, so "the point the target is
// set" has no code path. The live risk today is conversational - somebody says "I
// want to get down to 45 kilos" in chat - and the spec already says this applies
// "anywhere a goal or logged pattern looks like it is drifting unsafe, not only at
// initial goal-setting". So this ships on the conversational path, and a future
// structured target-setting screen calls the same assessment.

// WHO's underweight threshold. A round number with real clinical standing, used
// here to decide when to STOP COACHING rather than to diagnose anything - nothing
// in the app tells anybody their BMI or names a category at them.
//
// BMI is a poor instrument for an individual, and that is fine for this purpose:
// the failure mode that matters is coaching somebody toward a genuinely dangerous
// weight, and for that a blunt, well-known floor is the right shape. It errs
// toward caution and the consequence of erring is that Selodía declines to give
// one number - which costs the person very little.
const UNDERWEIGHT_BMI = 18.5;

// Below this, the goal is not merely under a threshold but a long way under it.
// Kept separate because it changes the tone rather than the mechanism.
const SEVERE_BMI = 16;

export type GoalAssessment =
  | { verdict: 'unknown'; reason: 'no-height' | 'no-goal' }
  | { verdict: 'safe'; bmi: number }
  | { verdict: 'unsafe'; bmi: number; severe: boolean };

export function bmiFor(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * Is a stated goal weight one Selodía should coach toward?
 *
 * Returns 'unknown' rather than guessing when height is missing. Height is
 * optional in this app, and a fabricated assessment either nags somebody whose
 * goal is fine or - far worse - clears one that is not.
 */
export function assessGoalWeight(
  goalKg: number | null | undefined,
  heightCm: number | null | undefined
): GoalAssessment {
  if (goalKg == null || !Number.isFinite(goalKg) || goalKg <= 0) {
    return { verdict: 'unknown', reason: 'no-goal' };
  }
  if (heightCm == null || !Number.isFinite(heightCm) || heightCm <= 0) {
    return { verdict: 'unknown', reason: 'no-height' };
  }
  const bmi = bmiFor(goalKg, heightCm);
  if (bmi == null) return { verdict: 'unknown', reason: 'no-height' };
  if (bmi >= UNDERWEIGHT_BMI) return { verdict: 'safe', bmi };
  return { verdict: 'unsafe', bmi, severe: bmi < SEVERE_BMI };
}

// What the model is told on the turn an unsafe goal is stated.
//
// It instructs BEHAVIOUR, not a verdict: the app has already decided this is
// unsafe, and the model's job is to respond well, not to re-litigate the maths or
// announce a calculation. Deliberately no BMI figure and no category word - a
// number and a label handed to somebody about their own goal is exactly the
// clinical, verdict-delivering register Part Two's second principle rules out.
export const UNSAFE_GOAL_TURN_BLOCK = `

THE GOAL THEY HAVE JUST STATED IS BELOW A SAFE RANGE FOR THEIR HEIGHT. The app has worked this out; you do not need to and must not show any calculation, BMI figure, or category word for it.

Say something honest and kind about it, once, in your own register - that you are not able to help them aim for that particular number, and why, in plain human terms rather than clinical ones. Do not lecture, do not repeat it later in the conversation, and do not moralise about the goal or about them for holding it.

Then keep going as normal. Logging is completely unaffected and you must not imply otherwise - they can record anything they like and you respond to it exactly as you always would. What stops is COACHING TOWARD THAT NUMBER: no daily calorie figure or deficit built on it, no timeline for reaching it, no "you'd need to be at X by Y". If they ask for those specifics, say plainly that you are not going to work that one out, without making it a confrontation.

They may be perfectly fine and simply have a number in their head. Treat them as an adult who has said something you are not going to help with, not as somebody in crisis.`;

// And on every turn afterwards.
//
// Shorter, because it is standing context rather than a moment. The one thing it
// must prevent is drifting back into coaching two days later, once the exchange
// has scrolled out of the window that made it obvious.
export const UNSAFE_GOAL_STANDING_BLOCK = `

A GOAL THEY MENTIONED EARLIER SITS BELOW A SAFE RANGE FOR THEIR HEIGHT. This was already raised with them once and must not be raised again unprompted - saying it a second time is nagging, and they heard you.

Carry on completely normally, including all logging. Simply do not produce numeric coaching built on that goal: no target calorie figure or deficit derived from it, and no timeline for reaching it. If they raise it themselves, respond honestly and briefly, then move on.`;

/**
 * Should a resource card go out with this turn?
 *
 * ONCE, EVER. `flaggedAt` is the stamp on the account - null means it has never
 * happened. The spec is explicit that the resource is offered once and not
 * repeated unprompted every session, and this is the whole of that guarantee.
 */
export function shouldOfferResource(
  assessment: GoalAssessment,
  flaggedAt: string | null | undefined
): boolean {
  return assessment.verdict === 'unsafe' && !flaggedAt;
}

/**
 * The right prompt block for this turn, or '' when there is nothing to say.
 *
 * The turn block wins over the standing block: on the turn somebody restates an
 * unsafe goal, the immediate instruction is the one that should govern.
 */
export function goalSafetyPrompt(
  assessment: GoalAssessment,
  flaggedAt: string | null | undefined
): string {
  if (assessment.verdict === 'unsafe') return UNSAFE_GOAL_TURN_BLOCK;
  if (flaggedAt) return UNSAFE_GOAL_STANDING_BLOCK;
  return '';
}
