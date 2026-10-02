// WHAT HER PHONE WILL NOW SHOW, from her real stored row through the real module.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-her-protein.mjs
//
// A PROBE, NOT A CHECK: it reads production. It exists because the two figures
// Ruth photographed on 2 October were both produced by code that typechecked and
// both looked plausible, so the only evidence worth having is the arithmetic her
// own row actually goes through - on every surface, at once.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const supabase = createClient(
  env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { calculateProteinTarget, proteinAssumptionNote } = await import(
  root + '/mobile/src/lib/protein.ts'
);
const { proteinTarget } = await import(root + '/app/lib/body-metrics.ts');

const { data: profiles } = await supabase
  .from('user_profile')
  .select('user_id, muscle_focus_state, protein_target_g, training_state');

for (const p of profiles ?? []) {
  const { data: w } = await supabase
    .from('current_weight')
    .select('weight_kg')
    .eq('user_id', p.user_id)
    .maybeSingle();
  const { data: m } = await supabase
    .from('body_measurements')
    .select('body_fat_pct')
    .eq('user_id', p.user_id)
    .not('body_fat_pct', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(1);

  const input = {
    manualG: p.protein_target_g,
    weightKg: w?.weight_kg == null ? null : Number(w.weight_kg),
    bodyFatPct: m?.[0]?.body_fat_pct == null ? null : Number(m[0].body_fat_pct),
    muscleFocus: p.muscle_focus_state,
    training: p.training_state,
  };

  // EVERY SURFACE, SIDE BY SIDE. Today, the goals panel and Drives all call the
  // Expo module; the day sums and onboarding chat call the Next mirror. If those
  // two ever differ again, it shows up here as two lines that do not match.
  const expo = calculateProteinTarget(input);
  const next = proteinTarget(input);
  const same = JSON.stringify(expo) === JSON.stringify(next);

  console.log(`\n  ${String(p.user_id).slice(0, 8)}  ${input.weightKg} kg, ${input.bodyFatPct}% fat, muscle: ${input.muscleFocus}, training: ${input.training ?? 'not said'}`);
  console.log(
    `    Expo (Today, goals, Drives): ${
      expo == null
        ? 'no target'
        : expo.kind === 'manual'
          ? `${expo.grams} g, her own figure`
          : `${expo.low}-${expo.high} g, ${expo.basis}, stepped ${expo.stepped}`
    }`
  );
  console.log(`    Next (day sums, chat):       ${same ? 'identical' : 'DIFFERENT - ' + JSON.stringify(next)}`);
  const note = proteinAssumptionNote(expo);
  if (note) console.log(`    says: ${note}`);
  if (!same) process.exitCode = 1;
}
