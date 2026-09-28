// CAN THE LIBRARY ACTUALLY SHOW EVERY RUNG WE SEED?
//
// Ruth's brief: "Seed only ladders the library can honestly show; list the
// missing clips." This is the check that makes the first half true and prints
// the second half.
//
// WHY IT IS A CHECK AND NOT A COMMENT. In September the app claimed movement
// demonstration coverage it did not have, twice, and both drafts are still in
// Drive marked SUPERSEDED because the numbers were wrong. The difference
// between "we believe every rung has a clip" and "every rung has a clip" is a
// query, and it costs a second.
//
// IT ALSO PROVES IT CAN FAIL: a deliberately invented movement is checked
// alongside the real ones, and the run refuses if the library claims to have it.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-skill-clips.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { LADDERS, CLIP_GAPS } from '../mobile/src/lib/skill-ladders.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    E[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
}

const supabase = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from('movement_assets').select('match_key');
if (error) {
  console.error('Could not read movement_assets:', error.message);
  process.exit(1);
}
const have = new Set(data.map((r) => r.match_key));
console.log(`  ${have.size} clips in the library\n`);

let missing = 0;
for (const ladder of LADDERS) {
  console.log(`  ${ladder.name}`);
  for (const rung of ladder.rungs) {
    // A null clip is an honest admission, not a failure: the app says "no
    // demonstration yet" rather than showing blank space. A NAMED clip that
    // does not exist is the failure, because the screen would silently show
    // nothing while claiming to show something.
    if (rung.clip === null) {
      console.log(`    --  ${rung.name}  (no demonstration, and says so)`);
      continue;
    }
    const ok = have.has(rung.clip);
    if (!ok) missing += 1;
    console.log(`    ${ok ? 'ok' : 'NO'}  ${rung.name}  ->  ${rung.clip}`);
  }
  console.log();
}

// THE CHECK ON THE CHECK. If this passes, the lookup is not looking anything up.
const INVENTED = 'triple reverse moon squat';
if (have.has(INVENTED)) {
  console.error(`  SELF-TEST FAILED: the library claims to have "${INVENTED}".`);
  process.exit(2);
}

console.log('  THE GAP LIST - movements a ladder wants and the library cannot show:\n');
for (const gap of CLIP_GAPS) {
  // Reported rather than trusted: if one of these turns up in the library
  // later, the gap list is out of date and should say so loudly.
  const nowExists = [...have].some((k) => k.includes(gap.movement.toLowerCase()));
  console.log(`    ${nowExists ? 'NOW EXISTS -> ' : ''}${gap.movement}  -  ${gap.wantedFor}`);
  if (nowExists) missing += 1;
}

console.log();
if (missing > 0) {
  console.log(`  ${missing} problem(s): a seeded rung names a clip that is not there,`);
  console.log('  or the gap list is out of date. Neither should ship.');
} else {
  console.log(`  Every seeded rung has a clip. ${CLIP_GAPS.length} gaps, all still real.`);
}
// exitCode rather than process.exit(): calling exit while the supabase client
// still holds an open handle makes libuv print an assertion failure AFTER a
// clean run, which reads exactly like a crash and is not one.
process.exitCode = missing > 0 ? 1 : 0;
