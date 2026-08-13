// Server-side body-metric calculations for the onboarding targets conversation
// (UNFLUMP_SPEC.md, Part Seven steps 10-11). These produce the numbers the
// onboarding-chat route states in-conversation, computed deterministically
// rather than left to the model to do arithmetic. Pure and unit-traceable.
//
// The Mifflin-St Jeor BMR here is the onboarding STARTING estimate; the
// Dashboard's basal-metabolism trend (client, reads real scale bmr) takes over
// as scale readings accumulate (decision B). Returns null on any missing/invalid
// input so the caller falls back to asking rather than stating a wrong number.

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Whole years from an ISO date-of-birth. `now` is injectable for deterministic tests.
export function ageFromDateOfBirth(dateOfBirth: string, now: Date = new Date()): number | null {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

// Mifflin-St Jeor equation.
export function calculateBMR(params: {
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  dateOfBirth: string | null | undefined;
  biologicalSex: string | null | undefined;
  now?: Date;
}): number | null {
  const { weightKg, heightCm, dateOfBirth, biologicalSex, now } = params;
  if (weightKg == null || weightKg <= 0) return null;
  if (heightCm == null || heightCm <= 0) return null;
  if (!dateOfBirth) return null;
  const age = ageFromDateOfBirth(dateOfBirth, now);
  if (age == null) return null;
  const sex = biologicalSex?.toLowerCase();
  if (sex !== 'male' && sex !== 'female') return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

// TDEE = BMR × activity multiplier.
export function calculateTDEE(bmr: number | null, activityLevel: string | null | undefined): number | null {
  if (bmr == null || bmr <= 0) return null;
  const mult =
    activityLevel && activityLevel in ACTIVITY_MULTIPLIERS
      ? ACTIVITY_MULTIPLIERS[activityLevel as ActivityLevel]
      : undefined;
  if (mult == null) return null;
  return Math.round(bmr * mult);
}

// Daily protein target in grams (UNFLUMP_SPEC.md, Part Eight): lean mass ×2.2,
// falling back to bodyweight when no muscle reading exists. Mirrors the client-
// side protein.ts formula so onboarding can state it server-side; the tiny
// duplication is deliberate (the client Dashboard and the server conversation
// can't share a lib across the Next/Expo boundary).
export function proteinTargetGrams(
  muscleKg: number | null | undefined,
  weightKg: number | null | undefined
): number | null {
  if (muscleKg != null && muscleKg > 0) return Math.round(muscleKg * 2.2);
  if (weightKg != null && weightKg > 0) return Math.round(weightKg * 2.2);
  return null;
}
