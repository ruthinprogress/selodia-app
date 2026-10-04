// CAN CHAT ACTUALLY SEE THE COLUMNS IT THINKS IT HAS?
//
//   node scripts/check-chat-reads-what-it-casts.mjs
//
// THIS EXISTS BECAUSE I BROKE IT MYSELF, ON 4 OCTOBER 2026, HOURS AFTER RUTH
// REPORTED THE SYMPTOM.
//
// She asked chat for a week of her saturated fat. It said it could not see it and
// did not tell her she could switch it on. I wrote app/lib/tracked-macro-summary.ts
// so it could do both, wired it to `profile?.tracked_macros` in the chat route,
// typechecked it, shipped it - and `tracked_macros` is not one of the columns
// turn_context selects. It had been reading `undefined` from the moment it landed.
// The feature built to answer her complaint could not answer it.
//
// THE FAULT IS NOT THE MISSING COLUMN. It is that there are two lists:
//
//   the SELECT, in a migration    supabase/migrations/*turn_context*.sql
//   the CAST, in TypeScript       app/api/ask-selodia/route.ts
//
// and nothing compared them. A column missing from the select is not an error in
// either language: Postgres never sees the request, TypeScript believes the cast,
// and the value is `undefined` - which every reader downstream treats as "she has
// not set that", the single most plausible wrong answer available. This is the
// sixth instance of collected, stored, and read by nobody in one week, and the
// first where the reader existed and the pipe did not.
//
// SO THIS COMPARES THE TWO LISTS. It cannot reach the database - checks run with
// no credentials - so it reads the migrations, which is the right source anyway:
// the database is what the migrations say, and a column that reaches production
// without one is a separate fault this cannot help with.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

// Every migration that touches turn_context, whole. Deliberately not just the
// select lists: the function is built up by a full definition and then widened by
// DO blocks, so the columns live in several shapes - a bare select list, a
// `wider text :=` literal, a replacement block. Reading the files entire makes the
// check loose in one direction only: a column named in a comment and nowhere else
// would pass. It would still have caught tracked_macros, which appears in no
// turn_context migration at all.
const MIG = 'supabase/migrations';
const turnContextSql = readdirSync(MIG)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(`${MIG}/${f}`, 'utf8'))
  .filter((sql) => sql.includes('turn_context'))
  .join('\n');

/** The field names in `const profile = profileRow as { ... } | null;`. */
function castFields() {
  const start = route.indexOf('const profile = profileRow as {');
  assert.ok(start > 0, 'the profile cast has gone - has the route been rewritten?');
  const end = route.indexOf('} | null;', start);
  assert.ok(end > start, 'the profile cast has no end');
  const body = route.slice(start, end);
  const names = [];
  for (const line of body.split('\n')) {
    const m = /^\s{4}([a-z_][a-z0-9_]*)\??:/.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

console.log('\n  CHAT READS WHAT IT CASTS\n');

check('there is something to compare', () => {
  const fields = castFields();
  assert.ok(fields.length > 10, `only ${fields.length} fields found in the cast`);
  assert.ok(turnContextSql.length > 1000, 'no turn_context migrations found');
  return `${fields.length} cast fields against ${
    readdirSync(MIG).filter((f) => f.endsWith('.sql')).length
  } migrations`;
});

check('every column chat casts is one turn_context selects', () => {
  const missing = castFields().filter(
    (name) => !new RegExp(`\\b${name}\\b`).test(turnContextSql)
  );
  assert.ok(
    missing.length === 0,
    `chat reads these and turn_context never sends them, so each one is ` +
      `permanently undefined and reads downstream as "she has not set that":\n          ` +
      missing.join(', ')
  );
  return 'no silently undefined columns';
});

check('and this check can fail', () => {
  // PROVING THE TEST CAN FAIL, because a check whose assertion is trivially true
  // is worse than no check: it reports PASS for the thing it is not testing. The
  // whole mechanism is run here against a column nobody has ever had.
  const invented = 'favourite_biscuit';
  assert.ok(
    !new RegExp(`\\b${invented}\\b`).test(turnContextSql),
    'the fixture column exists after all - pick another'
  );
  const wouldFail = [invented].filter(
    (name) => !new RegExp(`\\b${name}\\b`).test(turnContextSql)
  );
  assert.strictEqual(wouldFail.length, 1, 'the comparison does not notice a missing column');
  return 'a column turn_context does not select is detected';
});

check('the four read since this evening are among them', () => {
  // NAMED RATHER THAN COUNTED, because these are the ones that make chat quote a
  // figure her phone does not show: the switches, the pause, the day she set her
  // activity level, and the macros she switched on.
  const fields = castFields();
  for (const name of ['body_mode', 'paused_at', 'activity_level_set_at', 'tracked_macros']) {
    assert.ok(fields.includes(name), `chat no longer casts ${name}`);
    assert.ok(new RegExp(`\\b${name}\\b`).test(turnContextSql), `turn_context does not send ${name}`);
  }
  return 'body_mode, paused_at, activity_level_set_at, tracked_macros';
});

check('the pause and the switches reach the figures, not just the route', () => {
  // THE OTHER HALF OF THE SAME FAULT, one file along. calculateCalorieTarget has
  // had a `paused` branch and a `weightDirectionStated` argument since this
  // evening, and the one call site that every figure chat quotes passed neither -
  // so a column selected, cast and never forwarded would have looked identical
  // from here. She taps Pause on Today, asks chat what to eat, and is told her
  // deficit: the app contradicting a choice she just made.
  const targets = readFileSync('app/lib/daily-targets.ts', 'utf8');
  const at = targets.indexOf('calorieTarget: calculateCalorieTarget({');
  assert.ok(at > 0, 'the day state no longer works out a calorie target');
  const call = targets.slice(at, targets.indexOf('}),', at));
  assert.ok(/\bpaused,/.test(call), 'her Pause does not reach the figure chat quotes');
  assert.ok(
    /weightDirectionStated: weightDirectionStated\(mode\)/.test(call),
    'Build muscle alone and Maintain + Build reach the figure as the same thing'
  );
  return 'paused and weightDirectionStated are both forwarded';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
