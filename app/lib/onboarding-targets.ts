// Deterministic, traceable builders for the onboarding-targets conversation's
// numeric turns (UNFLUMP_SPEC.md, Part Seven steps 10-11). Per decision A, every
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

// The confirm-turn statement of the protein target, tied to today's logged total.
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
