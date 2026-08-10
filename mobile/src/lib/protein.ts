export type ProteinTarget = {
  grams: number;
  source: 'muscle_mass' | 'bodyweight_fallback';
  expectToImprove: boolean;
};

// Lean body mass (muscle_kg) is preferred (UNFLUMP_SPEC.md, Part Eight) since it stays
// accurate in a deficit; falls back to bodyweight when no scale reading exists yet.
export function calculateProteinTarget(
  muscleKg: number | null | undefined,
  weightKg: number | null | undefined,
  hasScales: boolean
): ProteinTarget | null {
  if (muscleKg != null && muscleKg > 0) {
    return { grams: Math.round(muscleKg * 2.2), source: 'muscle_mass', expectToImprove: false };
  }
  if (weightKg != null && weightKg > 0) {
    return { grams: Math.round(weightKg * 2.2), source: 'bodyweight_fallback', expectToImprove: hasScales };
  }
  return null;
}
