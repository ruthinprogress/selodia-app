// WHAT THE MACRO BLOCK ACTUALLY PRODUCES FOR A REAL ACCOUNT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-tracked-macro-block.mjs
//
// WHY A PROBE AND NOT A CHECK. check-tracked-macros-reach-chat.mjs runs the same
// function over stub rows and passes, and has passed all along - while chat told
// Ruth twice that her saturated fat is not in her log. A check proves the
// function works on the data it is given. This proves what it is given.
//
// It reads, prints and changes nothing.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { buildTrackedMacroBlock } = await import(root + '/app/lib/tracked-macro-summary.ts');

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const at = l.indexOf('=');
      return [l.slice(0, at), l.slice(at + 1).replace(/^["']|["']$/g, '')];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('  No service key in .env.local, so this cannot read as the server does.');
  process.exit(2);
}

const USER = process.argv[2] ?? '37ce3854-b805-4dd6-95f1-0a670e67d27d';
const supabase = createClient(url, key);

const { data: profile, error } = await supabase
  .from('user_profile')
  .select('tracked_macros')
  .eq('user_id', USER)
  .maybeSingle();

if (error) {
  console.error('  Could not read the profile:', error.message);
  process.exit(1);
}

console.log('\n  STORED tracked_macros:', JSON.stringify(profile?.tracked_macros));

const block = await buildTrackedMacroBlock(supabase, USER, profile?.tracked_macros ?? null);

console.log(`\n  BLOCK LENGTH: ${block.length}\n`);
console.log(block || '  (EMPTY - the model is told nothing about her macros at all)');
console.log('');
