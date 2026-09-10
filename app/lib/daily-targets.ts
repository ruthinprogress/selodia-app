import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateBMR, calculateTDEE, proteinTarget, type ProteinTarget } from './body-metrics';

// What is left of today, for the chat pipeline. Build item 22's foundation.
//
// THE GAP THIS CLOSES, and it is wider than the Meal Advisor. Until 2026-09-09
// the chat prompt carried the food ALREADY LOGGED and no target of any kind -
// `protein_target_g` appeared in `ask-selodia` exactly zero times. So Selodía
// could see what somebody had eaten and had no idea whether it was a lot or a
// little for them. Item 22 asks for "choices given remaining daily targets",
// which is not buildable at all while the remaining targets are invisible; and
// the same blindness quietly limited every ordinary "how am I doing today?".
//
// THE MATRIX BELOW IS A MIRROR, and saying so is the point. `calculateCalorieTarget`
// has lived in `mobile/src/lib/calorie-target.ts` since 2026-08-15 and the Overview
// renders from it. This is the same rule on the server, exactly as
// `body-metrics.ts` already mirrors its BMR/TDEE primitives the other way.
// Duplication across the Next/Expo boundary is a real hazard in this project -
// the onboarding openers went three-way and nothing caught it - so
// `scripts/probe-target-parity.mjs` runs both implementations over all nine
// Fat×Muscle combinations and fails if they ever disagree.

export type FocusState = 'reduce' | 'maintain' | 'increase';
export type CalorieTargetMode = 'deficit' | 'maintenance' | 'surplus';

export type CalorieTarget = {
  targetKcal: number;
  mode: CalorieTargetMode;
  isRecomposition: boolean;
  deltaKcal: number;
};

const KCAL_PER_KG = 7700;
const WEEKLY_LOSS_FRACTION = 0.005;
const SURPLUS_KCAL = 150;
const ROUND_TO = 10;

const roundTo = (n: number, step: number): number => Math.round(n / step) * step;

export function calculateCalorieTarget(params: {
  tdeeKcal: number | null | undefined;
  weightKg: number | null | undefined;
  fatFocus: FocusState;
  muscleFocus: FocusState;
}): CalorieTarget | null {
  const { tdeeKcal, weightKg, fatFocus, muscleFocus } = params;
  if (tdeeKcal == null || tdeeKcal <= 0) return null;

  const wantsGrowth =
    fatFocus === 'increase' || (fatFocus === 'maintain' && muscleFocus === 'increase');
  if (wantsGrowth) {
    return {
      targetKcal: roundTo(tdeeKcal + SURPLUS_KCAL, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: SURPLUS_KCAL,
    };
  }

  if (fatFocus === 'reduce' && muscleFocus !== 'increase') {
    if (weightKg == null || weightKg <= 0) return null;
    const dailyDeficit = Math.round((WEEKLY_LOSS_FRACTION * weightKg * KCAL_PER_KG) / 7);
    return {
      targetKcal: roundTo(tdeeKcal - dailyDeficit, ROUND_TO),
      mode: 'deficit',
      isRecomposition: false,
      deltaKcal: -dailyDeficit,
    };
  }

  return {
    targetKcal: roundTo(tdeeKcal, ROUND_TO),
    mode: 'maintenance',
    isRecomposition: fatFocus === 'reduce' && muscleFocus === 'increase',
    deltaKcal: 0,
  };
}

const asFocus = (v: unknown): FocusState =>
  v === 'reduce' || v === 'increase' ? v : 'maintain';

export type DayState = {
  kcalEaten: number;
  proteinEaten: number;
  calorieTarget: CalorieTarget | null;
  protein: ProteinTarget | null;
};

/**
 * Today's intake and today's targets, or as much of both as the data supports.
 *
 * NOTHING IS FABRICATED WHEN THE DATA IS ABSENT. Height is optional, a scale
 * reading may never have been taken, and the Focus states may be untouched - so
 * every field here is independently nullable and the prompt block below simply
 * omits what it does not have. A target invented from missing inputs is the
 * failure Part Eight already recorded once, when a protein figure derived from
 * bodyweight was displayed as though it had been measured.
 */
export async function loadDayState(
  supabase: SupabaseClient,
  profile: {
    height_cm?: number | null;
    date_of_birth?: string | null;
    biological_sex?: string | null;
    activity_level?: string | null;
    fat_focus_state?: string | null;
    muscle_focus_state?: string | null;
    protein_target_g?: number | null;
  } | null,
  dayStartISO: string
): Promise<DayState> {
  const [{ data: todayFood }, { data: latest }] = await Promise.all([
    supabase.from('food_logs').select('kcal, protein_g').gte('happened_at', dayStartISO),
    supabase
      .from('body_measurements')
      .select('weight_kg, body_fat_pct, bmr')
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = (todayFood ?? []) as { kcal: number | null; protein_g: number | null }[];
  const kcalEaten = Math.round(rows.reduce((n, r) => n + (r.kcal ?? 0), 0));
  const proteinEaten = Math.round(rows.reduce((n, r) => n + (r.protein_g ?? 0), 0));

  const m = (latest ?? null) as { weight_kg: number | null; body_fat_pct: number | null; bmr: number | null } | null;

  // A measured BMR from the scale beats an estimate, per Part Eight. The estimate
  // is the fallback, not the default.
  const bmr =
    m?.bmr ??
    calculateBMR({
      weightKg: m?.weight_kg ?? null,
      heightCm: profile?.height_cm ?? null,
      dateOfBirth: profile?.date_of_birth ?? null,
      biologicalSex: profile?.biological_sex ?? null,
    });

  return {
    kcalEaten,
    proteinEaten,
    calorieTarget: calculateCalorieTarget({
      tdeeKcal: calculateTDEE(bmr, profile?.activity_level),
      weightKg: m?.weight_kg ?? null,
      fatFocus: asFocus(profile?.fat_focus_state),
      muscleFocus: asFocus(profile?.muscle_focus_state),
    }),
    protein: proteinTarget(profile?.protein_target_g ?? null, m?.weight_kg ?? null, m?.body_fat_pct ?? null),
  };
}

/**
 * The prompt block. Empty string when there is nothing worth saying.
 *
 * Numbers only - what was eaten, what the target is, what is left. It carries NO
 * instruction about how to talk about them, because that belongs with the rest of
 * the conduct rules and because a block that both states facts and gives orders
 * is one nobody can edit safely later.
 */
export function buildDayStatePrompt(day: DayState): string {
  const lines: string[] = [];

  if (day.calorieTarget) {
    const left = day.calorieTarget.targetKcal - day.kcalEaten;
    lines.push(
      `Energy: ${day.kcalEaten} kcal logged today against a target of ` +
        `${day.calorieTarget.targetKcal} (${day.calorieTarget.mode}` +
        `${day.calorieTarget.isRecomposition ? ', recomposition - slow simultaneous change, never promised as a guarantee' : ''}` +
        `), so ${left >= 0 ? `${left} left` : `${Math.abs(left)} over`}.`
    );
  } else {
    lines.push(
      `Energy: ${day.kcalEaten} kcal logged today. THERE IS NO CALORIE TARGET - the data ` +
        `needed to work one out is missing, so do not state, estimate or imply one.`
    );
  }

  if (day.protein?.kind === 'manual') {
    const left = day.protein.grams - day.proteinEaten;
    lines.push(
      `Protein: ${day.proteinEaten}g logged against their own set target of ${day.protein.grams}g, ` +
        `so ${left >= 0 ? `${left}g left` : `${Math.abs(left)}g over`}.`
    );
  } else if (day.protein?.kind === 'range') {
    lines.push(
      `Protein: ${day.proteinEaten}g logged against a range of ${day.protein.low}-${day.protein.high}g, ` +
        `derived from ${day.protein.basis === 'lean_mass' ? 'their lean mass' : 'their bodyweight'}. ` +
        `${day.protein.basis === 'bodyweight' ? 'That basis is a fallback and less precise, so treat the range as approximate.' : ''}`
    );
  } else {
    lines.push(`Protein: ${day.proteinEaten}g logged today, with no target derivable.`);
  }

  return `\n\nTODAY SO FAR (computed by the app, not by you - never recalculate or second-guess these figures):\n${lines.join('\n')}`;
}
