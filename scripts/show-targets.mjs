// WHAT ARE THIS PERSON'S TARGETS, RIGHT NOW, FROM THE REAL ROWS?
//
// Written 29 September 2026 because Ruth asked to see the numbers her new focus
// states produce, and the honest way to answer that is to read her actual
// profile and her actual latest reading rather than to work it out from
// remembered values. The Today screen does this arithmetic on the phone; this
// does the same arithmetic on the same rows, so the answer can be checked
// before the phone is in her hand.
//
//   node --import ./scripts/ts-paths.mjs scripts/show-targets.mjs [userId]

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { calculateCalorieTarget } from '../app/lib/daily-targets.ts';
import { calculateBMR, calculateTDEE, proteinTarget } from '../app/lib/body-metrics.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const USER = process.argv[2] ?? '37ce3854-b805-4dd6-95f1-0a670e67d27d';
const supabase = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);

const { data: profile } = await supabase
  .from('user_profile')
  .select('height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, protein_target_g')
  .eq('user_id', USER)
  .maybeSingle();

const { data: latest } = await supabase
  .from('body_measurements')
  .select('measured_at, weight_kg, body_fat_pct, bmr')
  .eq('user_id', USER)
  .order('measured_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (!profile) {
  console.error('No profile.');
  process.exit(1);
}

// A MEASURED BMR FROM THE SCALE BEATS AN ESTIMATE, per Part Eight, and the
// estimate is the fallback rather than the default - the same order the app
// uses, because showing a different number here than the phone shows would be
// worse than showing none.
const estimated = calculateBMR({
  weightKg: latest?.weight_kg ?? null,
  heightCm: profile.height_cm ?? null,
  dateOfBirth: profile.date_of_birth ?? null,
  biologicalSex: profile.biological_sex ?? null,
});
const bmr = latest?.bmr ?? estimated;
const tdee = calculateTDEE(bmr, profile.activity_level);

const calories = calculateCalorieTarget({
  tdeeKcal: tdee,
  weightKg: latest?.weight_kg ?? null,
  fatFocus: profile.fat_focus_state,
  muscleFocus: profile.muscle_focus_state,
});
const protein = proteinTarget(profile.protein_target_g, latest?.weight_kg ?? null, latest?.body_fat_pct ?? null);

const show = (v) => (v == null ? 'not stated' : v);

console.log(`\n  ${USER}\n`);
console.log(`    fat focus       ${show(profile.fat_focus_state)}`);
console.log(`    muscle focus    ${show(profile.muscle_focus_state)}`);
console.log(`    height          ${show(profile.height_cm)} cm`);
console.log(`    activity        ${show(profile.activity_level)}`);
console.log(`    latest reading  ${latest ? `${latest.weight_kg} kg, ${latest.body_fat_pct ?? '-'}% fat, ${String(latest.measured_at).slice(0, 10)}` : 'none'}`);
console.log(`    BMR             ${bmr ? Math.round(bmr) : 'unknown'}${latest?.bmr ? ' (measured by the scale)' : ' (estimated)'}`);
console.log(`    TDEE            ${tdee ? Math.round(tdee) : 'unknown'}`);
console.log();

if (!calories) {
  console.log('    CALORIES        no target - a focus is unstated, or there is no weight');
} else {
  console.log(`    CALORIES        ${calories.targetKcal} kcal  (${calories.mode}, ${calories.deltaKcal >= 0 ? '+' : ''}${calories.deltaKcal} on TDEE)`);
  if (calories.isRecomposition) console.log('                    recomposition - maintenance calories, not a deficit');
}

if (!protein) {
  console.log('    PROTEIN         no target - no weight, or no body fat reading');
} else if (protein.kind === 'manual') {
  console.log(`    PROTEIN         ${protein.grams} g  (set by hand)`);
} else {
  console.log(`    PROTEIN         ${protein.low}-${protein.high} g  (from lean mass)`);
}
console.log();
process.exitCode = 0;
