// WHAT DOES THE CHAT ACTUALLY GET TOLD ABOUT TODAY?
//
// Before designing a "what should I eat for the rest of today?" button, the
// question is whether the thing behind it already knows the answer. The route
// puts buildDayStatePrompt in front of the model on every turn. This prints that
// exact block for her real account, so the design argues with the truth rather
// than with what the replies seemed to imply.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-day-state.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { buildDayState, buildDayStatePrompt, loadDayStateRows } from '../app/lib/daily-targets.ts';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const USER = '37ce3854-b805-4dd6-95f1-0a670e67d27d';

const { data: profile } = await admin
  .from('user_profile')
  .select('*')
  .eq('user_id', USER)
  .maybeSingle();

const rows = await loadDayStateRows(admin, USER);
const state = buildDayState(rows, profile);

console.log('\nRAW ROWS THE STATE IS BUILT FROM\n');
console.log('  today food:', JSON.stringify(rows.todayFood));
console.log('  latest    :', JSON.stringify(rows.latest));
console.log('  focus     :', profile?.fat_focus_state, '/', profile?.muscle_focus_state);
console.log('  height/dob:', profile?.height_cm, '/', profile?.date_of_birth, '/', profile?.activity_level);

console.log('\nCOMPUTED STATE\n');
console.log(JSON.stringify(state, null, 2));

console.log('\nWHAT THE MODEL IS TOLD, VERBATIM');
console.log(buildDayStatePrompt(state));

// And the same thing with a day's food in it, because an empty day cannot show
// whether the block is useful - it can only show that it is honest.
const pretend = buildDayState(
  { todayFood: [{ kcal: 480, protein_g: 26 }, { kcal: 320, protein_g: 11 }], latest: rows.latest },
  profile
);
console.log('\nAND WITH 800 KCAL / 37g ALREADY LOGGED TODAY');
console.log(buildDayStatePrompt(pretend));
