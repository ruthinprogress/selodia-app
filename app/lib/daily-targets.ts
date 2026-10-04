import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateBMR, calculateTDEE, proteinTarget, type ProteinTarget } from './body-metrics';
import { pregnancyGuard } from './not-built-for-pregnancy';
import { calorieFloor, explainTarget, intentFromFocus, type TargetWorking } from './body-intent';

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
  /** Why the figure is not what her goal implies, or null when it is. Mirrors
   *  mobile/src/lib/calorie-target.ts, where the reasoning lives. */
  heldBecause: 'training_paused' | 'deficit_paused' | 'paused' | null;
};

const KCAL_PER_KG = 7700;
const WEEKLY_LOSS_FRACTION = 0.005;
// 0.25% of bodyweight a week - half the fat-loss rate, which is the right order
// for gaining, and gentle on purpose. Faster is mostly fat and harder to keep.
const WEEKLY_GAIN_FRACTION = 0.0025;
// Building muscle with no weight direction stated: 5% of what she uses. Low on
// purpose - fat is easier to gain than muscle at this stage of life, and the
// cost of being slightly under is slower progress rather than fat gained.
export const BUILD_SURPLUS_FRACTION = 0.05;
// The ceiling, stated rather than implied. It binds above about 109 kg, so for
// almost everybody the scaled figure is what applies; it exists so that scaling
// can never become a reason the number keeps growing.
const SURPLUS_CEILING_KCAL = 300;

/** The daily surplus for gaining weight: scaled, capped, and never typed in. */
export function gainSurplusKcal(weightKg: number): number {
  const daily = Math.round((WEEKLY_GAIN_FRACTION * weightKg * KCAL_PER_KG) / 7);
  return Math.min(daily, SURPLUS_CEILING_KCAL);
}

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
  /** 'paused' removes the muscle-gain surplus. See mobile/src/lib/calorie-target.ts. */
  training?: 'training' | 'paused' | null;
  /** 'paused' holds a fat-loss target at maintenance without changing her goal. */
  deficitState?: 'on' | 'paused' | null;
  /** Her one Pause. True puts every combination at what her body uses. */
  paused?: boolean;
  /**
   * Whether she stated a weight direction at all.
   *
   * THE WHOLE OF THE BUILD-ALONE DISTINCTION. "Build muscle" with nothing said
   * about weight gets the small surplus that building needs; "Maintain weight"
   * with it does not, because she said so. The two store the same focus pair, so
   * the focus pair cannot carry this - see user_profile.body_mode.
   */
  weightDirectionStated?: boolean;
}): CalorieTarget | null {
  const { tdeeKcal, weightKg, bmrKcal, fatFocus, muscleFocus, lifeStage } = params;
  const paused = params.paused === true;
  const weightStated = params.weightDirectionStated !== false;
  const trainingPaused = params.training === 'paused';
  const deficitPaused = params.deficitState === 'paused';
  if (tdeeKcal == null || tdeeKcal <= 0) return null;

  // ONE PAUSE, AND IT LIVES HERE (Ruth's matrix reply, 4 October 2026).
  //
  //   "ONE quick Pause: a single tap puts her at maintenance (calories = her
  //   TDEE, protein = the maintenance range) without changing her toggles."
  //
  // It is checked FIRST and returns before any focus is read, because that is
  // what makes it one rule rather than a variant of each: every combination
  // pauses to exactly the same place, and no branch below can disagree with it.
  //
  // IT BELONGS IN THE FUNCTION THAT MAKES THE NUMBER, not in each surface that
  // shows one. Today, Drives, the day sums and the chat context all call this;
  // a pause applied in the UI would be a pause four places have to remember,
  // which is the shape of every figure that has disagreed with itself in this
  // app - two protein targets, two weights, a stale goal.
  //
  // HER TOGGLES ARE UNTOUCHED. Nothing is written when she pauses, so Resume is
  // simply this flag going false and every figure returning exactly as it was.
  if (paused) {
    return {
      targetKcal: roundTo(tdeeKcal, ROUND_TO),
      mode: 'maintenance',
      isRecomposition: false,
      deltaKcal: 0,
      flooredAt: null,
      heldBecause: 'paused',
    };
  }


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

// A SURPLUS ONLY WHEN SHE HAS ASKED TO GAIN WEIGHT (Ruth's decision, 4 October
// 2026, option A).
//
//   "Build muscle never adds calories on its own; calories rise only when Gain
//   weight is on. Build alone, Maintain+Build and Lose+Build sit at what she
//   uses with protein at the top of its range; Gain and Gain+Build use the
//   bodyweight-scaled surplus."
//
// WHAT THIS FIXES. `wantsGrowth` used to include fat:maintain + muscle:increase,
// so turning on Build muscle added 150 kcal a day - and turning on BOTH "Maintain
// weight" and "Build muscle" still added them, which is the app contradicting the
// switch she had just pressed. It is the general form of the "Get stronger" fault
// she found the same evening: a control that silently moved her calories.
//
// Building muscle at the weight she is now is recomposition, which is a real and
// extremely common goal for a woman over forty. It does not need extra calories;
// it needs the protein, which it still gets.
//
// THE RATE IS SCALED AND CAPPED. A flat 150 is a different thing at 50 kg and at
// 100 kg. 0.25% of bodyweight a week is half the fat-loss rate, which is the
// right order for gaining - and the ceiling is there because the scaling must
// never become a reason the number grows without limit.
  const wantsGrowth = fatFocus === 'increase';
  if (wantsGrowth) {
    // A PAUSE TAKES BACK THE MUSCLE SURPLUS, NEVER THE WEIGHT-GAIN ONE
    // (4 October 2026, found by writing the matrix out).
    //
    // The 150 kcal has two different reasons behind it depending on who asked
    // for it, and only one of them is about training:
    //
    //   Build muscle          the surplus feeds training. No training, no reason.
    //   Gain weight           the surplus IS the goal. Training is beside the point.
    //
    // Treating them the same meant somebody who had said "I want to gain weight"
    // and "my training is paused" had her calorie target quietly cut by 150 a
    // day - for an injury, a holiday, or any stretch where life got in the way.
    // That is the opposite of what the gain-weight mode is for, and it is the
    // one place in this app where taking calories away without being asked could
    // do real harm. Ruth's requirements for it are explicit: a capped, gentle
    // surplus and no pressure, with recovery handled as a clinician's business
    // rather than this app's.
    //
    // So the pause only applies where the surplus was earned by training.
    // SCALED, SO IT NEEDS A WEIGHT - exactly as the deficit does. Without one
    // there is no honest figure to give, and inventing a flat number for
    // somebody whose weight is unknown is how a gentle rate stops being gentle.
    if (weightKg == null || weightKg <= 0) return null;
    const surplus = gainSurplusKcal(weightKg);
    return {
      targetKcal: roundTo(tdeeKcal + surplus, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: surplus,
      flooredAt: null,
      heldBecause: null,
    };
  }

  if (fatFocus === 'reduce' && muscleFocus !== 'increase') {
    // Paused for a holiday, and still her goal. Checked before the weight
    // requirement: a paused deficit is just maintenance and needs no bodyweight.
    if (deficitPaused) {
      return {
        targetKcal: roundTo(tdeeKcal, ROUND_TO),
        mode: 'maintenance',
        isRecomposition: false,
        deltaKcal: 0,
        flooredAt: null,
        heldBecause: 'deficit_paused',
      };
    }
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
      heldBecause: null,
    };
  }

  // BUILD MUSCLE WITH NOTHING SAID ABOUT WEIGHT (Ruth's final rules, 4 October
  // 2026): "a SMALL SURPLUS, a percentage of what she uses, on the low side
  // because fat is easier to gain at this stage of life: start at 5% of TDEE."
  //
  // A PERCENTAGE OF TDEE, NOT OF BODYWEIGHT, and the difference is deliberate:
  // what building costs tracks what she already burns, not what she weighs. The
  // gain-weight surplus is the other way round because gaining weight is about
  // the body being added to.
  //
  // IT DOES NOT APPLY WHEN SHE SAID MAINTAIN. That is the same switch saying
  // "do not move my weight", and overriding it would be the app arguing.
  if (muscleFocus === 'increase' && fatFocus === 'maintain' && !weightStated) {
    const surplus = Math.round(tdeeKcal * BUILD_SURPLUS_FRACTION);
    return {
      targetKcal: roundTo(tdeeKcal + surplus, ROUND_TO),
      mode: 'surplus',
      isRecomposition: false,
      deltaKcal: surplus,
      flooredAt: null,
      heldBecause: null,
    };
  }

  return {
    targetKcal: roundTo(tdeeKcal, ROUND_TO),
    mode: 'maintenance',
    isRecomposition: fatFocus === 'reduce' && muscleFocus === 'increase',
    deltaKcal: 0,
    flooredAt: null,
    heldBecause:
      trainingPaused && fatFocus === 'reduce' && muscleFocus === 'increase'
        ? 'training_paused'
        : null,
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
  /**
   * HOW THOSE TWO FIGURES WERE REACHED, so chat can answer "where does that come
   * from?" without inventing an answer.
   *
   * Ruth, 2 October 2026: "I think you should be able to talk to chat to explain
   * what your targets are made from and what the assumptions are - this is very
   * important."
   *
   * NOT A SECOND DESCRIPTION OF THE SUM. This is `explainTarget` - the same
   * function, from the same module, that writes the working on the goals screen.
   * app/lib/body-intent.ts re-exports it from the Expo tree rather than copying
   * it, so chat and the screen cannot describe the same number differently. A
   * second wording would have been the two-protein-targets bug in prose.
   */
  working: TargetWorking | null;
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
  training_state?: string | null;
  deficit_state?: string | null;
  deficit_state_set_at?: string | null;
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

  // The working, when there is enough to work anything out at all. Null is the
  // honest answer for somebody with no goal set or no height: there is no target,
  // so there is nothing to explain, and a sentence here would be explaining a
  // figure that does not exist.
  const tdeeForWorking = calculateTDEE(bmr, profile?.activity_level);
  const intent = intentFromFocus(
    asFocus(profile?.fat_focus_state) as never,
    asFocus(profile?.muscle_focus_state) as never
  );
  const proteinForWorking = proteinTarget({
    manualG: profile?.protein_target_g ?? null,
    weightKg: m?.weight_kg ?? null,
    bodyFatPct: m?.body_fat_pct ?? null,
    muscleFocus: asFocus(profile?.muscle_focus_state),
    training: (profile?.training_state as never) ?? null,
  });
  function buildWorking(): TargetWorking | null {
    if (!intent) return null;
    return explainTarget({
      intent,
      weightKg: m?.weight_kg ?? null,
      // The day state reads body_measurements, so anything here was measured.
      weightSource: 'measured',
      bmrKcal: bmr,
      tdeeKcal: tdeeForWorking,
      // Chat has her activity level as a stored word rather than the phrase the
      // screen builds; null simply drops that clause rather than guessing at it.
      activityWord: null,
      proteinLow: proteinForWorking?.kind === 'range' ? proteinForWorking.low : null,
      proteinHigh: proteinForWorking?.kind === 'range' ? proteinForWorking.high : null,
      proteinStepped: proteinForWorking?.kind === 'range' ? proteinForWorking.stepped : null,
      deficitPaused: profile?.deficit_state === 'paused',
    });
  }

  return {
    kcalEaten,
    proteinEaten,
    calorieTarget: calculateCalorieTarget({
      lifeStage: profile?.life_stage ?? null,
      tdeeKcal: calculateTDEE(bmr, profile?.activity_level),
      weightKg: m?.weight_kg ?? null,
      fatFocus: asFocus(profile?.fat_focus_state),
      muscleFocus: asFocus(profile?.muscle_focus_state),
      training: (profile?.training_state as never) ?? null,
      deficitState: (profile?.deficit_state as never) ?? null,
    }),
    working: buildWorking(),
    protein: proteinTarget({
      manualG: profile?.protein_target_g ?? null,
      weightKg: m?.weight_kg ?? null,
      bodyFatPct: m?.body_fat_pct ?? null,
      muscleFocus: asFocus(profile?.muscle_focus_state),
      training: (profile?.training_state as never) ?? null,
    }),
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

  // WHERE THE FIGURES CAME FROM, SO SHE CAN ASK (2026-10-02).
  //
  // Ruth: "I think you should be able to talk to chat to explain what your
  // targets are made from and what the assumptions are - this is very important."
  //
  // She is right, and the gap was wider than it looks. The working has only ever
  // existed on the goals screen, at the one moment she sets a goal - so the
  // numbers she lives with every day had no explanation attached to them
  // anywhere, and the one surface she can actually ask a question on knew the
  // figures and nothing about where they came from. A model told "target 1,350"
  // and asked "why 1,350?" either says it does not know or makes something up,
  // and the second is what usually happens.
  //
  // THE SAME SENTENCES THE SCREEN SHOWS. This is explainTarget, re-exported from
  // the Expo tree rather than reworded here, so chat and the goals screen cannot
  // describe one number two ways. That failure is not hypothetical: on 2 October
  // two surfaces showed her two different protein targets because each worked out
  // its own.
  if (day.working && day.working.lines.length > 0) {
    lines.push('');
    lines.push(
      'HOW THOSE TARGETS WERE WORKED OUT - these are the exact lines the goals screen shows her, ' +
        'so you may quote or paraphrase them freely when she asks where a number comes from, ' +
        'what it assumes, or why it changed. Do NOT redo any of this arithmetic yourself:'
    );
    for (const line of day.working.lines) lines.push(`  - ${line}`);
  }

  // THE ASSUMPTIONS, NAMED AS ASSUMPTIONS. Her words again: "what the assumptions
  // are". The working above states them in passing; these are the two that are
  // SWITCHES she can throw, and a model that does not know they exist will tell
  // her the target cannot be changed without changing her goal, which is wrong.
  if (day.calorieTarget?.heldBecause === 'training_paused') {
    lines.push(
      'NOTE: the calorie figure is held at maintenance because she has said her training is ' +
        'paused, not because her goal changed. Her goal is unchanged and it returns on its own ' +
        'when she says she is training again, on her Body Manual.'
    );
  } else if (day.calorieTarget?.heldBecause === 'deficit_paused') {
    lines.push(
      'NOTE: she has paused her deficit - a holiday, a hard stretch, her reason is hers. The ' +
        'figure is maintenance for now. Her fat-loss goal is NOT cancelled and nothing was ' +
        'archived; it resumes when she switches it back on in her Body Manual. Never treat a ' +
        'paused deficit as her having given up on the goal.'
    );
  }

  return `\n\nTODAY SO FAR (computed by the app, not by you - never recalculate or second-guess these figures):\n${lines.join('\n')}`;
}
