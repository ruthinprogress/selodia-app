import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateBMR, calculateTDEE, proteinTarget, type ProteinTarget } from './body-metrics';
import { pregnancyGuard } from './not-built-for-pregnancy';
import { calorieFloor } from './body-intent';

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
  /**
   * The floor, when it raised the figure; null when it did not bite.
   * The screen says so rather than showing a number with no basis.
   */
  flooredAt: number | null;
};

const KCAL_PER_KG = 7700;
const WEEKLY_LOSS_FRACTION = 0.005;
const SURPLUS_KCAL = 150;
const ROUND_TO = 10;

const roundTo = (n: number, step: number): number => Math.round(n / step) * step;

// A FLOOR UNDER THE DEFICIT (2026-10-02).
//
// Ruth: "lose fat (moderate deficit with a floor)."
//
// There was no floor. The deficit is 0.5% of bodyweight a week, which for a
// small woman can land under what her body uses at rest - nothing in this
// function stopped it. At 56 kg and a BMR of 1,123 the figure comes out at about
// 1,430, which is fine; the same arithmetic at a lower TDEE is not, and the
// function had no opinion about where it stopped.
//
// THE HIGHER OF HER BMR AND 1,200, so neither is the loophole: BMR is what her
// body uses lying still, and 1,200 catches a BMR estimate that is itself
// implausibly low. The floor lives in lib/body-intent.ts so the figure and the
// sentence explaining it cannot disagree.
//
// `mode` STAYS 'deficit' WHEN THE FLOOR BITES. It is still a fat-loss intent and
// the UI should still frame it as one; what changed is the number, and
// `flooredAt` is how the screen knows to say so rather than show an unexplained
// figure. Silently clamping is the one outcome worse than either.
export function calculateCalorieTarget(params: {
  tdeeKcal: number | null | undefined;
  weightKg: number | null | undefined;
  /** Her BMR, for the floor under the deficit. Without it the floor is 1,200. */
  bmrKcal?: number | null;
  fatFocus: FocusState | null | undefined;
  muscleFocus: FocusState | null | undefined;
  /** Her answer about where she is, so pregnancy can stand this down. */
  lifeStage?: string | null;
}): CalorieTarget | null {
  const { tdeeKcal, weightKg, bmrKcal, fatFocus, muscleFocus, lifeStage } = params;
  if (tdeeKcal == null || tdeeKcal <= 0) return null;

  // PREGNANCY STANDS THE ARITHMETIC DOWN ENTIRELY (2026-09-30).
  //
  // Not "a gentler deficit" and not "maintenance instead" - NO TARGET. This
  // function's own comment above makes the case for the null: a figure shown
  // without a basis is a silence wearing a choice's clothes, and there is no
  // basis here at all. Energy needs in pregnancy change by trimester and this
  // app has no trimester. See not-built-for-pregnancy.ts.
  if (pregnancyGuard(lifeStage).holdAtMaintenance) return null;

  // A FOCUS NOBODY STATED IS NOT MAINTENANCE (2026-09-28).
  //
  // Until today both columns were NOT NULL DEFAULT 'maintain' and `asFocus`
  // turned null into 'maintain' on both sides of the Next/Expo boundary. So a
  // person who had never been asked, and never answered, was shown a
  // maintenance target as though she had chosen it. All three accounts in the
  // database carried it, including Ruth's, set to maintain while she trains for
  // a muscle up.
  //
  // Null now means not stated, and not stated means there is no target to show.
  // Maintenance remains reachable - "keep things steady" writes it - and that is
  // the whole difference: a choice rather than a silence wearing a choice's
  // clothes.
  if (fatFocus == null || muscleFocus == null) return null;

  const wantsGrowth =
    fatFocus === 'increase' || (fatFocus === 'maintain' && muscleFocus === 'increase');
  if (wantsGrowth) {
    return {
      targetKcal: roundTo(tdeeKcal + SURPLUS_KCAL, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: SURPLUS_KCAL,
      flooredAt: null,
    };
  }

  if (fatFocus === 'reduce' && muscleFocus !== 'increase') {
    if (weightKg == null || weightKg <= 0) return null;
    const dailyDeficit = Math.round((WEEKLY_LOSS_FRACTION * weightKg * KCAL_PER_KG) / 7);
    const floor = calorieFloor(bmrKcal);
    const wanted = roundTo(tdeeKcal - dailyDeficit, ROUND_TO);
    const floored = wanted < floor;
    return {
      targetKcal: floored ? roundTo(floor, ROUND_TO) : wanted,
      mode: 'deficit',
      isRecomposition: false,
      // THE DELTA STAYS TRUE TO THE FIGURE, not to the intention. A target
      // held at the floor is a smaller deficit than 0.5% a week asked for,
      // and reporting the larger one would misdescribe what she is eating.
      deltaKcal: floored ? roundTo(floor, ROUND_TO) - roundTo(tdeeKcal, ROUND_TO) : -dailyDeficit,
      flooredAt: floored ? roundTo(floor, ROUND_TO) : null,
    };
  }

  return {
    targetKcal: roundTo(tdeeKcal, ROUND_TO),
    mode: 'maintenance',
    isRecomposition: fatFocus === 'reduce' && muscleFocus === 'increase',
    deltaKcal: 0,
    flooredAt: null,
  };
}

/**
 * A stored focus, or null when nothing is stored.
 *
 * THIS USED TO ANSWER 'maintain' TO ANYTHING IT DID NOT RECOGNISE, including
 * null, which is how everybody ended up on a maintenance target. It now
 * recognises the three real states and says null to everything else, so an
 * unset column reaches `calculateCalorieTarget` as unset and produces no target
 * instead of a fabricated one.
 */
const asFocus = (v: unknown): FocusState | null =>
  v === 'reduce' || v === 'increase' || v === 'maintain' ? v : null;

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
/** What the day state is worked out FROM: two reads, and nothing else. */
export type DayStateRows = {
  todayFood: { kcal: number | null; protein_g: number | null }[] | null;
  latest: { weight_kg: number | null; body_fat_pct: number | null; bmr: number | null } | null;
};

/**
 * The two reads on their own, so a caller can start them early.
 *
 * SPLIT FROM THE ARITHMETIC (2026-09-24). Neither read needs the profile -
 * it is only used for the sums afterwards - but loadDayState took the profile
 * as an argument, so every caller had to wait for the profile query to come
 * back before these two could even be sent. In ask-selodia that made it the
 * last of three sequential round trips in front of the model call, worth 130ms
 * to 540ms of a spoken turn spent waiting on an ordering that was never real.
 */
export async function loadDayStateRows(
  supabase: SupabaseClient,
  dayStartISO: string
): Promise<DayStateRows> {
  const [{ data: todayFood }, { data: latest }] = await Promise.all([
    supabase.from('food_logs').select('kcal, protein_g').gte('happened_at', dayStartISO),
    supabase
      .from('body_measurements')
      .select('weight_kg, body_fat_pct, bmr')
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { todayFood, latest } as DayStateRows;
}

export type DayStateProfile = {
  height_cm?: number | null;
  date_of_birth?: string | null;
  biological_sex?: string | null;
  activity_level?: string | null;
  fat_focus_state?: string | null;
  muscle_focus_state?: string | null;
  protein_target_g?: number | null;
  // Read since 30 September so the arithmetic can stand down in pregnancy.
  life_stage?: string | null;
} | null;

/** The sums, once both the rows and the profile are in hand. */
export function buildDayState(rowsIn: DayStateRows, profile: DayStateProfile): DayState {
  const { todayFood, latest } = rowsIn;
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
      lifeStage: profile?.life_stage ?? null,
      tdeeKcal: calculateTDEE(bmr, profile?.activity_level),
      weightKg: m?.weight_kg ?? null,
      fatFocus: asFocus(profile?.fat_focus_state),
      muscleFocus: asFocus(profile?.muscle_focus_state),
    }),
    protein: proteinTarget(profile?.protein_target_g ?? null, m?.weight_kg ?? null, m?.body_fat_pct ?? null),
  };
}

/** Both halves, for a caller with nothing to gain from starting the reads early. */
export async function loadDayState(
  supabase: SupabaseClient,
  profile: DayStateProfile,
  dayStartISO: string
): Promise<DayState> {
  return buildDayState(await loadDayStateRows(supabase, dayStartISO), profile);
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
