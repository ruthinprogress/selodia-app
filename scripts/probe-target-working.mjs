// WHAT CHAT IS TOLD ABOUT HER TARGETS, from her real row.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-target-working.mjs
//
// Ruth: "I think you should be able to talk to chat to explain what your targets
// are made from and what the assumptions are - this is very important."
//
// A probe rather than a check: it reads production, and what matters here is
// whether the block READS like an answer to that question. A passing assertion
// that the string is non-empty would not tell anybody that.

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
const { buildDayState, buildDayStatePrompt } = await import(root + '/app/lib/daily-targets.ts');

const USER = process.argv[2] ?? '37ce3854-b805-4dd6-95f1-0a670e67d27d';

const { data: profile } = await supabase
  .from('user_profile')
  .select(
    'height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, protein_target_g, life_stage, training_state, deficit_state'
  )
  .eq('user_id', USER)
  .maybeSingle();

const { data: latest } = await supabase
  .from('body_measurements')
  .select('weight_kg, body_fat_pct, bmr')
  .eq('user_id', USER)
  .order('measured_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// EVERY COMBINATION OF THE TWO SWITCHES, because the point of the block is that
// she can ask "what if I pause this?" and get a straight answer either way.
for (const [training, deficitState] of [
  [profile?.training_state ?? null, profile?.deficit_state ?? null],
  ['paused', null],
  [null, 'paused'],
]) {
  const day = buildDayState(
    { todayFood: [], latest },
    { ...profile, training_state: training, deficit_state: deficitState }
  );
  console.log(
    `\n${'='.repeat(70)}\n  training: ${training ?? 'not said'}   deficit: ${deficitState ?? 'not said'}\n${'='.repeat(70)}`
  );
  console.log(buildDayStatePrompt(day));
}
