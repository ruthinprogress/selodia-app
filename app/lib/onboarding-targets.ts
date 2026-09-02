// Deterministic, traceable builders for the onboarding-targets conversation's
// numeric turns (SELODIA_SPEC.md, Part Seven steps 10-11). Per decision A, every
// stated number comes from here (route reply-override), never from the model, so
// a misparse can never reach a figure. The model only extracts unit-components,
// classifies confirm/correct, and provides warmth around these fixed statements.

const round1 = (n: number): number => Math.round(n * 10) / 10;

// The propose-turn echo of the interpreted height/weight, for confirmation.
export function formatMeasurementEcho(heightCm: number | null, weightKg: number | null): string {
  const parts: string[] = [];
  if (heightCm != null) parts.push(`${Math.round(heightCm)} cm`);
  if (weightKg != null) parts.push(`${round1(weightKg)} kg`);
  return `Just so I've got this right — that's ${parts.join(' and ')}. Have I got that right?`;
}

// WHERE THERE IS NO LEAN-MASS READING, no number is stated at all. This offers
// the range the evidence actually supports and hands the choice over (Part
// Eight, redesigned 2026-09-01).
//
// The pattern here is deliberate and reusable: INFORM the range, EXPLAIN what
// moves someone within it, then LET THEM CHOOSE. It replaces a bodyweight
// calculation that produced a confident specific figure from data that could not
// support one - and the fix for that is not a better formula, it is not
// pretending to have one. See SELODIA_SPEC.md, Part Eight.
//
// "Most active women" is the population this app is for (Part One), so the
// framing is true rather than generic. The range scales with their weight, so
// "at your weight" means their weight.
export function formatProteinRangeOffer(low: number, high: number): string {
  return `Most active women feel good somewhere between ${low}-${high} g a day at your weight. Some people pick a number in that range and adjust as they go — others want to dig into it a bit more. Which feels right for you?`;
}

// The "tell me more" branch, stated in code rather than left to the model for the
// same reason every other number here is: the relationship between lean mass and
// the target is the substance of the answer, and a paraphrase could get it wrong.
export function formatProteinExplainer(low: number, high: number): string {
  return `The range is wide because it is based on your bodyweight, and protein need really tracks your muscle mass — bodyweight includes everything else. A bioimpedance scale reads muscle mass directly, and with that number the target gets a lot more precise instead of being a span.

Within ${low}-${high} g: if you are actively trying to build muscle, the higher end is where that work gets supported. If you are maintaining, or focused on reducing body fat, the middle sits comfortably. None of it is a threshold — nothing goes wrong at ${low - 5} g.

What would you like to go with?`;
}

// The confirm-turn statement of the protein target, tied to today's logged total.
// Reached only when a lean-mass reading exists, and worded as a suggestion: it is
// a good starting point, not a prescription, and it can be changed by saying so.
export function formatProteinStatement(targetGrams: number, loggedTodayGrams: number): string {
  return `Based on that, a good daily protein target for you is around ${targetGrams} g. You've had ${loggedTodayGrams} g so far today — no pressure, just so you can see where things are.`;
}

// The confirm-turn TDEE statement, framed as an estimate that sharpens over time.
export function formatTDEEStatement(tdee: number): string {
  return `From that, your daily energy use works out to roughly ${tdee} kcal. That's a starting estimate — it'll sharpen as real readings come in. Does that sound about right, or am I missing something?`;
}

const ACTIVITY_DESCRIPTIONS: Record<string, string> = {
  sedentary: 'mostly sitting, without much regular movement',
  light: 'lightly active — a bit of movement here and there',
  moderate: 'fairly active, with some regular movement or exercise',
  active: 'quite active, moving a good deal most days',
  very_active: 'very active — hard training or on your feet all day',
};

// The propose-turn echo of the interpreted activity level, for confirmation.
export function formatActivityEcho(level: string): string {
  const desc = ACTIVITY_DESCRIPTIONS[level] ?? level;
  return `So it sounds like you're ${desc}. Does that feel about right?`;
}
