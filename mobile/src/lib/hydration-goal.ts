// TODAY'S WATER GOAL, WITH ITS REASONS (2026-09-19).
//
// Ruth, with a ChatGPT design brief: "The 2 L target isn't universal ... Selodía
// is about teaching people why, not giving arbitrary targets." The flat 2 L
// this replaces was chosen as "a round, unfussy figure" so that nobody would
// chase precision; the answer to that worry is not a vaguer number but a
// number that says where it came from.
//
// ONLY WHAT THE APP ACTUALLY KNOWS. The brief suggested weather, weight,
// pregnancy and diet. Selodía has no weather, and would be inventing a
// forecast. Weight is known, but the reference intake for women (EFSA 2010:
// 2.0 L of total water a day, roughly 80% of it from drinks) does not scale by
// body weight, and a ml-per-kg rule would be a formula presented as evidence.
// What remains, and is real: a baseline, and the activity she logged today.
// Anything added later - a disclosed pregnancy (EFSA: +300 ml), breastfeeding
// (+700 ml) - joins as another reason, in the same shape.
//
//   Baseline 1.6 L - EFSA's 2.0 L of total water for women, less the fifth or
//     so that arrives in food.
//   Activity - about 500 ml per hour logged today. Sweat losses in exercise
//     vary widely (ACSM's position stand puts common rates between about 0.3
//     and 2.4 L an hour); half a litre an hour is the modest end of ordinary
//     sessions, and the reason line says "about" because it is.
//
// Rounded to the nearest 100 ml: finer than that would claim an accuracy no
// part of this has. Pure, so it is testable: scripts/probe-hydration-goal.mjs.

export const BASELINE_ML = 1600;
export const ML_PER_ACTIVE_HOUR = 500;

export type HydrationGoal = {
  ml: number;
  /** Plain sentences saying where the number came from, baseline first. */
  reasons: string[];
};

export function formatVolume(ml: number): string {
  if (ml >= 1000) return `${Math.round(ml / 100) / 10} L`;
  return `${Math.round(ml)} ml`;
}

export function hydrationGoal({ activityMinutesToday }: { activityMinutesToday: number }): HydrationGoal {
  const minutes = Number.isFinite(activityMinutesToday) && activityMinutesToday > 0 ? activityMinutesToday : 0;
  const forActivity = Math.round(((minutes / 60) * ML_PER_ACTIVE_HOUR) / 50) * 50;
  const ml = Math.round((BASELINE_ML + forActivity) / 100) * 100;

  const reasons = [
    'About 1.6 L from drinks is a typical day for women. The rest of the 2 L the body needs usually comes from food.',
  ];
  if (forActivity > 0) {
    reasons.push(
      `Today's ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} of activity adds about ${formatVolume(forActivity)}. More if it was hot or you sweated a lot.`
    );
  }
  return { ml, reasons };
}

// HOW FULL THE DROPLET LOOKS. Not a score (Ruth: "I'm not sure the droplet has
// to become completely full ... If you only drank 1.6 L of a 2.0 L target,
// that's still a good day"). So the goal sits at about four-fifths, not at the
// brim: reaching it is not a finish line, there is no full-to-the-top moment
// to chase, and drinking past it simply carries on filling, gently, towards a
// top it only reaches well beyond the goal.
export const GOAL_FILL = 0.8;

export function dropletFill(ml: number, goalMl: number): number {
  if (!(goalMl > 0) || !(ml > 0)) return 0;
  return Math.min((ml / goalMl) * GOAL_FILL, 0.96);
}
