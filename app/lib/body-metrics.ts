// Server-side body-metric calculations for the onboarding targets conversation
// (SELODIA_SPEC.md, Part Seven steps 10-11). These produce the numbers the
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

// Daily protein target in grams (SELODIA_SPEC.md, Part Eight): lean mass ×2.2,
// falling back to bodyweight when no muscle reading exists. Mirrors the client-
// side protein.ts formula so onboarding can state it server-side; the tiny
// duplication is deliberate (the client Dashboard and the server conversation
// can't share a lib across the Next/Expo boundary).
// The server twin of mobile/src/lib/protein.ts. The two MUST change together -
// they are the same rule computed on both sides of the Next/Expo boundary, and a
// divergence would have onboarding state one number while the Overview bar shows
// another.
//
// muscle_kg x 2.2 was retired on 2026-09-03 in favour of lean body mass derived
// from body fat percentage. `muscle_kg` is not standardised across scale
// manufacturers - skeletal muscle mass, lean body mass and fat-free mass all get
// reported under that one label - so the old target depended on which scale
// someone owned. See mobile/src/lib/protein.ts for the full reasoning; this is
// the same rule, and the two must not diverge.
//
// body_fat_pct is a PERCENTAGE (26.4, not 0.264), hence the divide by 100.
export type ProteinTarget =
  | { kind: 'manual'; grams: number }
  | { kind: 'range'; low: number; high: number; basis: 'lean_mass' | 'bodyweight' };

const MIN_PLAUSIBLE_BF_PCT = 3;
const MAX_PLAUSIBLE_BF_PCT = 70;

export function leanBodyMassKg(
  weightKg: number | null | undefined,
  bodyFatPct: number | null | undefined
): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  if (bodyFatPct == null) return null;
  if (bodyFatPct < MIN_PLAUSIBLE_BF_PCT || bodyFatPct > MAX_PLAUSIBLE_BF_PCT) return null;
  return weightKg * (1 - bodyFatPct / 100);
}

export function proteinTarget(
  manualG: number | null | undefined,
  weightKg: number | null | undefined,
  bodyFatPct: number | null | undefined
): ProteinTarget | null {
  if (manualG != null && manualG > 0) return { kind: 'manual', grams: Math.round(manualG) };
  const lbm = leanBodyMassKg(weightKg, bodyFatPct);
  if (lbm != null && lbm > 0) {
    return { kind: 'range', low: Math.round(lbm * 2.0), high: Math.round(lbm * 2.4), basis: 'lean_mass' };
  }
  if (weightKg != null && weightKg > 0) {
    return { kind: 'range', low: Math.round(weightKg * 1.6), high: Math.round(weightKg * 2.0), basis: 'bodyweight' };
  }
  return null;
}

// 1.6-2.0 g per kg of bodyweight, scaled so "at your weight" is true for whoever
// is reading it. Mirrors proteinRange in mobile/src/lib/protein.ts.
export function proteinRangeGrams(
  weightKg: number | null | undefined
): { low: number; high: number } | null {
  if (weightKg == null || weightKg <= 0) return null;
  return { low: Math.round(weightKg * 1.6), high: Math.round(weightKg * 2.0) };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Deterministic unit normalization (decision A): the model extracts raw
// components exactly as expressed; these convert to cm/kg in code, never the
// model. Result rounded to 0.1 (ample for a BMR/protein estimate) so it's stable
// and echo-friendly. Null when nothing usable was given.
export function normalizeHeight(input: {
  cm?: number | null;
  feet?: number | null;
  inches?: number | null;
}): number | null {
  if (input.cm != null && input.cm > 0) return round1(input.cm);
  const feet = input.feet ?? 0;
  const inches = input.inches ?? 0;
  if (feet > 0 || inches > 0) return round1(feet * 30.48 + inches * 2.54);
  return null;
}

export function normalizeWeight(input: {
  kg?: number | null;
  lb?: number | null;
  stone?: number | null;
  stoneLb?: number | null;
}): number | null {
  if (input.kg != null && input.kg > 0) return round1(input.kg);
  if (input.lb != null && input.lb > 0) return round1(input.lb * 0.453592);
  const stone = input.stone ?? 0;
  const stoneLb = input.stoneLb ?? 0;
  if (stone > 0 || stoneLb > 0) return round1(stone * 6.35029 + stoneLb * 0.453592);
  return null;
}
