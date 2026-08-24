// The working-weight control's maths (build item 35, slice E).
//
// The control is a slider defaulting to 1kg increments whose number is ALWAYS
// directly editable, so any value can simply be typed over it (settled
// 2026-08-21). That combination is deliberate: real equipment lands on odd
// numbers — Smith machines, oddly-weighted bars, whatever plates a gym happens
// to own — and no increment chosen in advance can anticipate them. The slider
// covers the common case quickly; typing covers everything else exactly.
//
// Kept out of the component so the mapping is testable without rendering, and
// so the snapping rule has one definition rather than being scattered through
// gesture handlers.

export const WEIGHT_STEP_KG = 1;
// A ceiling that no real working weight reaches, so the slider stays usable
// rather than compressing the whole useful range into a few pixels.
export const WEIGHT_MAX_KG = 300;

// The slider's visible range adapts to the weight in hand: a 20kg lift and a
// 180kg lift should both be adjustable, and a single fixed 0-300 track would
// make the first almost impossible to hit. Always starts at 0 so "no added
// weight" stays reachable for bodyweight movements.
export function sliderRange(currentKg: number | null): { min: number; max: number } {
  const c = typeof currentKg === 'number' && Number.isFinite(currentKg) ? currentKg : 0;
  const headroom = Math.max(40, Math.ceil(c * 1.5));
  return { min: 0, max: Math.min(WEIGHT_MAX_KG, Math.max(40, headroom)) };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Fraction along the track (0-1) -> a weight snapped to the step.
export function positionToWeight(fraction: number, range: { min: number; max: number }): number {
  const f = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1);
  const raw = range.min + f * (range.max - range.min);
  const snapped = Math.round(raw / WEIGHT_STEP_KG) * WEIGHT_STEP_KG;
  return clamp(snapped, range.min, range.max);
}

// A weight -> its fraction along the track, for positioning the handle. A typed
// value outside the range still renders at an end rather than off the track.
export function weightToPosition(weightKg: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(weightKg) || range.max <= range.min) return 0;
  return clamp((weightKg - range.min) / (range.max - range.min), 0, 1);
}

// Parse what someone typed. Deliberately permissive about decimals — 2.5, 62.5
// and 17.25 are all ordinary gym numbers, and rounding them would defeat the
// reason the field is editable at all. Returns null when it is not a usable
// weight, so the caller can decline rather than store a guess.
export function parseTypedWeight(text: string): number | null {
  // A minus sign is rejected rather than stripped. Removing a unit ("60kg" ->
  // 60) is helpful; removing a minus silently changes what the person typed
  // into a different number, and a negative weight is a mis-key worth saying so
  // about rather than quietly reinterpreting.
  if (text.includes('-')) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > WEIGHT_MAX_KG) return null;
  // Two decimals is past anything a plate set produces; beyond that it is a
  // typo rather than a real weight.
  return Math.round(n * 100) / 100;
}

// Trailing zeros read as false precision: 60, not 60.00.
export function formatWeight(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}

// "Current = latest" for the plan's display, read from the append-only history.
//
// Mirrors the server-side helper in app/lib/workout-logs.ts — the same
// Next/Expo boundary duplication already accepted for body-metrics and cycle.
// LATEST, deliberately not heaviest: coming back from injury or deloading goes
// down, and a max-based reading would quietly refuse to let anyone reduce their
// working weight.
export function latestWeightByExercise(
  rows: { exercise_name: string; weight_kg: number | string; logged_at: string }[]
): Map<string, number> {
  const latest = new Map<string, { at: number; kg: number }>();
  for (const r of rows) {
    const at = Date.parse(r.logged_at);
    const kg = typeof r.weight_kg === 'number' ? r.weight_kg : Number(r.weight_kg);
    if (!Number.isFinite(at) || !Number.isFinite(kg)) continue;
    const prev = latest.get(r.exercise_name);
    if (!prev || at > prev.at) latest.set(r.exercise_name, { at, kg });
  }
  return new Map([...latest].map(([name, v]) => [name, v.kg]));
}
