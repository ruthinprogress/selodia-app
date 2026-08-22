import type { SupabaseClient } from '@supabase/supabase-js';

import type { EccentricLoad, PlanIntensity } from './almanac';

// Workout progress logging (build item 35, slice B).
//
// The plan is a document; progress is append-only and lives in its own tables.
// Nothing here ever mutates plan content — a "current weight" written back into
// the plan would overwrite the history progressive overload depends on.

// Ordered weakest to strongest. Rank, not average, is what matters when rolling
// a session up (see sessionEccentricLoad).
const ECCENTRIC_ORDER: EccentricLoad[] = ['none', 'low', 'moderate', 'high'];
const INTENSITY_ORDER: PlanIntensity[] = ['light', 'moderate', 'intense'];

function highestOf<T extends string>(order: T[], values: (T | null | undefined)[]): T | null {
  let best = -1;
  for (const v of values) {
    const i = v == null ? -1 : order.indexOf(v);
    if (i > best) best = i;
  }
  return best >= 0 ? order[best] : null;
}

// A session's eccentric load is the HIGHEST of its exercises, never the average.
// Delayed-onset soreness is driven by the hardest eccentric work in the session
// — one heavy set of RDLs among nine gentle movements is exactly what makes
// someone sore two days later, and averaging would wash it out. The DOMS flag
// fires on moderate/high, so averaging would also silently suppress it.
export function sessionEccentricLoad(values: (EccentricLoad | null | undefined)[]): EccentricLoad | null {
  return highestOf(ECCENTRIC_ORDER, values);
}

export function sessionIntensity(values: (PlanIntensity | null | undefined)[]): PlanIntensity | null {
  return highestOf(INTENSITY_ORDER, values);
}

// "Current = latest" for the plan's display. Rows may arrive in any order, so
// this picks by timestamp rather than trusting position.
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

// Reject what cannot be a real working weight before it reaches the database.
// Kept permissive on decimals on purpose — 2.5, 62.5 and 17.25 are all ordinary
// gym numbers and the control exists to let them be typed.
export function isValidWeightKg(v: unknown): v is number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1000;
}

export async function logWorkingWeight(
  supabase: SupabaseClient,
  userId: string,
  input: { planId: string | null; exerciseName: string; weightKg: number }
): Promise<boolean> {
  if (!input.exerciseName?.trim() || !isValidWeightKg(input.weightKg)) return false;
  const { error } = await supabase.from('workout_weight_log').insert({
    user_id: userId,
    plan_id: input.planId,
    exercise_name: input.exerciseName.trim(),
    weight_kg: input.weightKg,
  });
  if (error) {
    console.log('WORKING WEIGHT LOG FAILED:', error.message);
    return false;
  }
  return true;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Record a completed exercise, and keep this session's single activity_logs row
// in step with it.
//
// ONE activity row per (plan, day) — not one per exercise. Ten ticked exercises
// writing ten activity rows would inflate the activity history, leave every row
// with a null duration and calorie figure, and make the DOMS flagger read ten
// separate sessions in one day. The row is created on the first tick and
// updated as more arrive, which the checkbox alone can drive; a "finish
// session" control would be inventing UI the design does not have.
export async function logCompletion(
  supabase: SupabaseClient,
  userId: string,
  input: {
    planId: string | null;
    planTitle: string;
    exerciseName: string;
    eccentricLoad: EccentricLoad | null;
    intensity: PlanIntensity | null;
  }
): Promise<boolean> {
  const exerciseName = input.exerciseName?.trim();
  if (!exerciseName) return false;
  const sessionDate = todayISODate();

  const { data: row, error } = await supabase
    .from('workout_completion_log')
    .insert({
      user_id: userId,
      plan_id: input.planId,
      exercise_name: exerciseName,
      session_date: sessionDate,
      eccentric_load: input.eccentricLoad,
      intensity: input.intensity,
    })
    .select('id')
    .maybeSingle();

  if (error || !row) {
    console.log('COMPLETION LOG FAILED:', error?.message);
    return false;
  }

  // From here on the completion is already safe. Everything below is the
  // derived activity row, so a failure is logged and swallowed rather than
  // reported as the tick having failed.
  try {
    const { data: session } = await supabase
      .from('workout_completion_log')
      .select('eccentric_load, intensity, activity_log_id')
      .eq('user_id', userId)
      .eq('plan_id', input.planId)
      .eq('session_date', sessionDate);

    const rows = session ?? [];
    const eccentric = sessionEccentricLoad(rows.map((r) => r.eccentric_load as EccentricLoad | null));
    const intensity = sessionIntensity(rows.map((r) => r.intensity as PlanIntensity | null));
    const existingId = rows.find((r) => r.activity_log_id)?.activity_log_id as string | undefined;

    let activityId = existingId ?? null;
    if (activityId) {
      await supabase
        .from('activity_logs')
        .update({ eccentric_load: eccentric, intensity })
        .eq('id', activityId);
    } else {
      const { data: created } = await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          activity_type: input.planTitle,
          happened_at: new Date().toISOString(),
          source: 'workout plan',
          eccentric_load: eccentric,
          intensity,
          // Left null deliberately: a ticked checkbox says nothing about how
          // long the session ran or what it burned, and inventing a figure
          // would poison data the rest of the app treats as measured.
          duration_min: null,
          kcal_burned: null,
        })
        .select('id')
        .maybeSingle();
      activityId = (created?.id as string) ?? null;
    }

    if (activityId) {
      await supabase.from('workout_completion_log').update({ activity_log_id: activityId }).eq('id', row.id);
    }
  } catch (err) {
    console.log('SESSION ACTIVITY ROLL-UP FAILED:', err instanceof Error ? err.message : err);
  }

  return true;
}
