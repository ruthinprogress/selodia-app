import { trainingFromActivity } from '@/lib/body-mode';
import { resolveTDEE } from '@/lib/body-metrics';
import { calculateCalorieTarget, type FocusState } from '@/lib/calorie-target';
import { calculateProteinTarget } from '@/lib/protein';
import { ageFrom as ageFromDob, type NutrientProfile } from '@/lib/nutrient-standing';
import { supabase } from '@/lib/supabase';

// THE TWO FIGURES ON THE GRID THAT ARE HERS, AND WHERE THEY COME FROM.
//
// nutrient-standing.ts needs four numbers to decide where a day stands: her
// age, her calorie target, and the two ends of her protein range. Eight of the
// ten nutrients it colours are published figures and need none of this; these
// two are the ones she set herself, and they are the only ones the screen may
// call a TARGET rather than a guideline.
//
// WHY THIS IS A FILE AND NOT A QUERY INSIDE THE FOOD LOG. Both figures are the
// end of a sum - TDEE from the scale's BMR or from her height, age and sex;
// then her fat and muscle focus; then the floor; then, for protein, lean mass
// from body fat percentage and whether she is training. Writing that sum a
// second time is how Ruth came to be shown two different protein targets one
// minute apart on 2 October, on the same body, because the Body tab and the
// goals screen were each deciding it for themselves.
//
// So this calls the same three functions the Body tab calls, with the same
// inputs, and adds no arithmetic of its own. If the target changes, it changes
// in one place and both screens move together.
//
// NULL IS A REAL ANSWER AND MUST SURVIVE. Somebody who has never weighed has
// no calorie target, and nobody without a date of birth has an age. The grid
// draws those tiles grey rather than comparing them to a number it invented -
// see referenceFor, which returns null for exactly this reason.

// THE TYPE AND THE AGE SUM LIVE IN nutrient-standing.ts, not here, because this
// file reaches Supabase and so reaches react-native - which a check running
// under plain node cannot import. Everything testable is on the other side of
// that line; this file is only the reads and the three calls.
export { ageFrom, NO_NUTRIENT_PROFILE, type NutrientProfile } from '@/lib/nutrient-standing';

const asFocus = (v: unknown): FocusState | null =>
  v === 'reduce' || v === 'maintain' || v === 'increase' ? v : null;

/**
 * WHETHER SHE IS STILL HAVING PERIODS, read off what she already told the app.
 *
 * Only the iron figure uses this, and only after 50. The NHS gives 8.7mg for
 * women from 50 and adds that women still menstruating may need the higher
 * 14.8mg - so a birthday is the wrong trigger, and deciding on her behalf that
 * her periods have stopped is not the app's call to make.
 *
 * NULL IS A REAL THIRD ANSWER and must survive: "not told" is not "no". Where
 * it is null the higher figure stands, because under-stating iron for a woman
 * who is still losing it monthly is the costlier of the two mistakes.
 *
 * `prefer_not_to_say` is deliberately null rather than false. Declining to
 * answer is not an answer.
 */
export function stillBleedingFrom(lifeStage: string | null | undefined): boolean | null {
  switch (lifeStage) {
    case 'regular':
    case 'irregular':
    case 'perimenopause':
      return true;
    case 'menopause':
    case 'post_menopause':
    case 'surgical':
    case 'induced':
    case 'no_periods_other':
      return false;
    default:
      return null;
  }
}

/**
 * Her age and her two self-set targets, or nulls where there is no answer.
 *
 * A MANUAL PROTEIN FIGURE IS A BAND OF ONE. She can type a single number
 * instead of accepting the range, and a band whose ends are equal is the honest
 * reading of that: she is in range at exactly her figure and nowhere else. The
 * alternative - treating a manual figure as a floor - would mark double her
 * protein as "in range", which is not what somebody who typed one number meant.
 */
export async function loadNutrientProfile(): Promise<NutrientProfile> {
  const [{ data: measurements }, { data: profile }] = await Promise.all([
    supabase
      .from('body_measurements')
      .select('weight_kg, body_fat_pct, bmr')
      .order('measured_at', { ascending: false })
      .limit(1),
    supabase
      .from('user_profile')
      .select(
        'height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, '
          + 'muscle_focus_state, protein_target_g, training_state, life_stage'
      )
      .maybeSingle(),
  ]);

  const latest = (measurements ?? [])[0] as
    | { weight_kg: number | null; body_fat_pct: number | null; bmr: number | null }
    | undefined;
  const p = (profile ?? null) as Record<string, unknown> | null;

  const tdee = resolveTDEE({
    scaleBmr: latest?.bmr ?? null,
    weightKg: latest?.weight_kg ?? null,
    heightCm: (p?.height_cm as number) ?? null,
    dateOfBirth: (p?.date_of_birth as string) ?? null,
    biologicalSex: (p?.biological_sex as string) ?? null,
    activityLevel: (p?.activity_level as string) ?? null,
  });

  const calories = calculateCalorieTarget({
    tdeeKcal: tdee?.tdeeKcal ?? null,
    weightKg: latest?.weight_kg ?? null,
    fatFocus: asFocus(p?.fat_focus_state),
    muscleFocus: asFocus(p?.muscle_focus_state),
    training: trainingFromActivity((p?.activity_level as never) ?? null),
    deficitState: (p?.deficit_state as never) ?? null,
  });

  const protein = calculateProteinTarget({
    manualG: (p?.protein_target_g as number) ?? null,
    weightKg: latest?.weight_kg ?? null,
    bodyFatPct: latest?.body_fat_pct ?? null,
    muscleFocus: asFocus(p?.muscle_focus_state),
    training: (p?.training_state as never) ?? null,
  });

  return {
    stillBleeding: stillBleedingFrom((p?.life_stage as string) ?? null),
    ageYears: ageFromDob((p?.date_of_birth as string) ?? null),
    targetKcal: calories?.targetKcal ?? null,
    proteinLow: protein == null ? null : protein.kind === 'manual' ? protein.grams : protein.low,
    proteinHigh: protein == null ? null : protein.kind === 'manual' ? protein.grams : protein.high,
  };
}
