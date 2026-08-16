// Client mirror of the BMR/TDEE primitives in `app/lib/body-metrics.ts`, plus
// the `resolveTDEE` sourcing helper the Body/Overview needs. The Next/Expo
// boundary means the server (onboarding conversation) and client (Dashboard)
// can't share a lib, so calculateBMR/calculateTDEE are duplicated deliberately —
// the same accepted duplication already used for proteinTargetGrams ↔
// protein.ts. **Keep the two files' formulas in sync** (a parity node-test
// guards this). Only the BMR/TDEE primitives are mirrored here; the server's
// onboarding-only helpers (normalizeHeight/Weight, proteinTargetGrams) are not.

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

export type TDEESource = 'scale_bmr' | 'estimated_bmr';
export type TDEEResult = {
  tdeeKcal: number;
  bmrKcal: number;
  bmrSource: TDEESource;
};

// Sources a TDEE for the calorie target: prefer the real scale BMR from the
// latest body_measurements reading; fall back to the Mifflin-St Jeor estimate
// (height/weight/DOB/sex) when no scale reading exists yet. Then × activity
// multiplier. `bmrSource` lets the UI caveat an estimate differently from a
// scale-derived figure (parallel to protein.ts's `source`). Returns null when
// neither BMR path yields a number, or when activityLevel is missing/invalid —
// the caller falls back to an empty state rather than showing a wrong number.
export function resolveTDEE(params: {
  scaleBmr: number | null | undefined; // latest body_measurements.bmr
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  dateOfBirth: string | null | undefined;
  biologicalSex: string | null | undefined;
  activityLevel: string | null | undefined;
  now?: Date;
}): TDEEResult | null {
  const { scaleBmr, weightKg, heightCm, dateOfBirth, biologicalSex, activityLevel, now } = params;

  let bmr: number | null;
  let bmrSource: TDEESource;
  if (scaleBmr != null && scaleBmr > 0) {
    bmr = Math.round(scaleBmr);
    bmrSource = 'scale_bmr';
  } else {
    bmr = calculateBMR({ weightKg, heightCm, dateOfBirth, biologicalSex, now });
    bmrSource = 'estimated_bmr';
  }
  if (bmr == null) return null;

  const tdeeKcal = calculateTDEE(bmr, activityLevel);
  if (tdeeKcal == null) return null;

  return { tdeeKcal, bmrKcal: bmr, bmrSource };
}
