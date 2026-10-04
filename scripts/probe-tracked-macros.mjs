// WHAT THE MODEL WILL NOW SEE WHEN SHE ASKS ABOUT SATURATED FAT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-tracked-macros.mjs
//
// A probe, because it reads production. The question it answers is not "does the
// function return a string" but "would this have answered her".

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
const { buildTrackedMacroBlock } = await import(root + '/app/lib/tracked-macro-summary.ts');

const USER = process.argv[2] ?? '37ce3854-b805-4dd6-95f1-0a670e67d27d';

const { data: profile } = await supabase
  .from('user_profile')
  .select('tracked_macros')
  .eq('user_id', USER)
  .maybeSingle();

console.log('\n  switched on:', JSON.stringify(profile?.tracked_macros));

const block = await buildTrackedMacroBlock(supabase, USER, profile?.tracked_macros ?? null);
console.log(block || '\n  (empty - nothing optional tracked, or the read failed)');

// The question she actually asked.
const sat = /(\d+)g saturated fat/g;
const week = [...block.matchAll(sat)].slice(0, 7).map((m) => Number(m[1]));
if (week.length > 0) {
  const total = week.reduce((a, b) => a + b, 0);
  console.log(
    `\n  Her question: saturated fat over the last ${week.length} logged days` +
      ` = ${total}g, averaging ${Math.round(total / week.length)}g a day.`
  );
}
