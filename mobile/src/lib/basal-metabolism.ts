export type BasalMetabolismPoint = {
  measuredAt: string;
  bmr: number;
  muscleKg: number | null;
};

// Only points with a bmr reading can contribute to the trend; sorted ascending
// for a left-to-right chart (UNFLUMP_SPEC.md, Part Eight)
export function getBasalMetabolismTrend(
  measurements: { measured_at: string; bmr: number | null; muscle_kg: number | null }[]
): BasalMetabolismPoint[] {
  return measurements
    .filter((m) => m.bmr != null && m.bmr > 0)
    .map((m) => ({ measuredAt: m.measured_at, bmr: m.bmr as number, muscleKg: m.muscle_kg ?? null }))
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
}
