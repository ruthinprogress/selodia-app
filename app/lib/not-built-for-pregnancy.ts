// SELODÍA IS NOT BUILT FOR PREGNANCY, AND SHOULD SAY SO RATHER THAN CARRY ON.
//
// Ruth, 30 September 2026, reviewing the Body Manual Setup architecture: "I
// don't think we can help through pregnancy at this stage, or if we do,
// maintenance is mandatory and a huge disclaimer must be ticked."
//
// My advice, which she accepted: a disclaimer improves the company's position
// and changes nothing about what the app does. With a tick box signed, Selodía
// would still compute a deficit, suggest movement and interpret weight for a
// pregnant woman with no pregnancy logic behind any of it.
//
// WHAT IS ACTUALLY DIFFERENT, and it is not a footnote:
//
//   energy needs change by trimester;
//   some movement becomes contraindicated - supine work after around sixteen
//     weeks, high fall-risk, heavy bracing;
//   WEIGHT GAIN IS EXPECTED AND HEALTHY, which inverts the entire body-fat
//     framing this app is built on;
//   and the red flags are a different list - bleeding, reduced fetal movement,
//     the signs of pre-eclampsia - none of which this app knows.
//
// So pregnancy is NOT offered as a life stage, and this file is what happens if
// somebody is pregnant anyway. Two things, both small:
//
//   the calorie arithmetic refuses to compute a deficit or a surplus;
//   and the chat says plainly that it is not built for this, and points at her
//   midwife or GP.
//
// A SEARCH OF app/ ON 30 SEPTEMBER FOUND THE WORD "pregnant" NOWHERE. Today a
// pregnant user would be given a deficit and encouraged towards it, silently.
// That is the gap this closes; it is not a pregnancy feature and must never be
// mistaken for one.

/** The life-stage values that mean the calorie arithmetic must stand down. */
const GUARDED_STAGES = new Set(['pregnant', 'breastfeeding', 'postpartum']);

export type PregnancyGuard = {
  /** True when no deficit and no surplus may be computed. */
  holdAtMaintenance: boolean;
  /** Which answer triggered it, for the note that explains itself. */
  stage: string | null;
};

export function pregnancyGuard(lifeStage: string | null | undefined): PregnancyGuard {
  const stage = (lifeStage ?? '').trim().toLowerCase();
  return {
    holdAtMaintenance: GUARDED_STAGES.has(stage),
    stage: GUARDED_STAGES.has(stage) ? stage : null,
  };
}

/**
 * What the app says about it, once, plainly.
 *
 * NOT AN APOLOGY AND NOT A DISCLAIMER. It states what the app will and will not
 * do and who the right source is. "Consult your healthcare provider" is the
 * sentence every app uses and nobody reads; a midwife is a specific person she
 * actually has.
 */
export const NOT_BUILT_FOR_PREGNANCY_NOTE =
  'Selodía is not built for pregnancy or the months after it, so it will not work out a calorie ' +
  'target while that is the case - your midwife or GP is the right source for what to eat and how ' +
  'to move. Everything else here still works, and your log is still yours.';

/**
 * The rule the chat model is given.
 *
 * WORDED AS A FACT ABOUT THE APP rather than as caution about her. She has not
 * done anything that needs handling; the app has a limit, and the honest move
 * is to name it.
 */
export const PREGNANCY_PROMPT_BLOCK = `IF THEY ARE PREGNANT, RECENTLY PREGNANT, OR BREASTFEEDING, THIS APP IS NOT BUILT FOR IT and you must say so rather than adapt. Never suggest a calorie deficit, never suggest losing fat or weight, never read a rising weight as a problem - weight gain in pregnancy is expected and healthy - and never suggest exercise beyond what they already does. Say once, plainly and without alarm, that Selodía has no pregnancy guidance in it and that their midwife or GP is the right source for eating and movement. Then carry on being useful for everything else: they can still log, still ask what is in a food, still keep their record. Do not repeat the limitation every turn.`;
