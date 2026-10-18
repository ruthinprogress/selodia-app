// A NEW GOAL RETIRES THE ONE IT REPLACES.
//
//   node scripts/check-goal-replaces.mjs
//
// Ruth, 18 October 2026, with a screenshot of three goals stacked on Plans:
//
//   "Goals get stacked ontop of old ones instead of replacing in Plans Tab.
//    The build for that section was mean to add old ones to a card in
//    Almanac>Goal History"
//
// Both halves were built and nothing joined them. mirror_context_goal turns a
// goal stated in chat into a user_goals row; goal_archived_to_almanac turns a
// goal whose archived_at is set into an Almanac card. The second fires on
// archived_at, and the only thing that ever set it was the onboarding screen -
// so a goal stated in chat, which is how nearly all of them arrive, inserted a
// row and retired nothing. She restated one body goal three times in a
// conversation and ended with three current goals, one of them the mistake the
// other two were written to correct.
//
// IT READS THE DATABASE, NOT THE MIGRATION FILE. That is the whole point of
// this one. A migration file proves what was written down; this proves what is
// deployed - and the fault being guarded against is a function someone edits in
// the dashboard, or a migration that was written and never applied. Her
// standing rule says a migration needs a file too, and this is the other half:
// the file needs a database that agrees with it.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function env() {
  const out = {};
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...out, ...process.env };
}

const e = env();
const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}\n          ${err.message}`);
    failures.push(name);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** The source of a deployed function, through the service-role-only helper. */
async function functionDef(name) {
  const { data, error } = await db.rpc('pg_function_source', { fn_name: name });
  if (error) {
    console.log(`  could not read ${name}: ${error.message}`);
    return null;
  }
  return data;
}

const mirror = await functionDef('mirror_context_goal');
// A function that reads user_goals and writes an almanac row, but archives
// nothing - the nearest miss available, used below to prove the patterns above
// actually discriminate. See the last check.
const otherFn = await functionDef('onboarding_complete_snapshot');

console.log('\n  A GOAL REPLACES, IT DOES NOT STACK\n');

check('THE DEPLOYED TRIGGER RETIRES WHAT WAS CURRENT', () => {
  ok(
    typeof mirror === 'string' && mirror.length > 0,
    'could not read the deployed function - add the pg_function_source helper, or this check proves nothing'
  );
  ok(
    /update public\.user_goals/i.test(mirror),
    'a goal stated in chat retires nothing again, so they will stack'
  );
  ok(/set archived_at = now\(\)/i.test(mirror), 'nothing is archived');
  ok(
    /archived_at is null/i.test(mirror),
    'it archives rows that are already archived, which rewrites their dates'
  );
  return 'the deployed function archives';
});

check('AND IT RETIRES BEFORE IT INSERTS, OR IT RETIRES ITSELF', () => {
  // THE TRAP. Archiving after the insert catches the goal that was just
  // stated, because by then it is one of the current ones - a trigger that
  // silently retires every goal the moment it is set, leaving Plans empty.
  const updateAt = mirror.search(/update public\.user_goals/i);
  const insertAt = mirror.search(/insert into public\.user_goals/i);
  ok(updateAt > -1 && insertAt > -1, 'one of the two statements is gone');
  ok(
    updateAt < insertAt,
    'the archive runs after the insert, so the new goal retires itself and Plans goes empty'
  );
  return 'archive, then insert';
});

check('and these assertions can fail', () => {
  // PROVED WITHOUT BREAKING THE LIVE TRIGGER. The honest mutation test would be
  // to deploy the old function, watch this go red, and put it back - on the
  // database somebody's goals are being written to. Seconds of exposure is
  // still exposure, and a failure between the two steps leaves it broken.
  //
  // So the same patterns are run against a function that genuinely does not
  // archive-then-insert into user_goals. onboarding_complete_snapshot READS
  // user_goals and writes an almanac row, which makes it the closest near miss
  // available: if these patterns are loose enough to pass it, they are loose
  // enough to pass a broken mirror_context_goal.
  ok(
    typeof otherFn === 'string' && otherFn.length > 0,
    'could not read the control function, so this proves nothing'
  );
  ok(/user_goals/.test(otherFn), 'the control no longer mentions user_goals, so it is not a near miss');
  ok(
    !/set archived_at = now\(\)/i.test(otherFn),
    'the archive pattern matches a function that archives nothing'
  );
  ok(
    !/update public\.user_goals/i.test(otherFn),
    'the retire pattern matches a function that retires nothing'
  );
  return 'the patterns reject a near miss';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
