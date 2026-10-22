// A REST DAY IS NOT A MOVEMENT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-rest-day-looks-restful.mjs
//
// Ruth, 22 October 2026, circling two rows on her Movement log: "Rest day needs
// a more restful icon. Currently the same as pullup practice."
//
// Both were falling through to the plain movement mark, because the matcher
// knew ten named disciplines and neither of these was one of them. So her
// Thursday - a day she deliberately did nothing - read as the same kind of
// thing as her pull-ups, and the two rows beside each other were identical.
//
// A rest day is the opposite of everything else on that screen and is the one
// entry that should look it.
//
// NOTHING HERE HAD A CHECK, which is why a fallback could quietly cover two
// very different things for a month. The matcher is free text in and ten shapes
// out, and the failure mode is never an error - it is a plausible wrong icon.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { activityIcon } = await import(here('mobile/src/lib/activity-icon.ts'));

// READ AS TEXT, NOT IMPORTED. log-rest-day.ts reaches supabase and then
// react-native, which node cannot load - the same split flower-geometry.ts and
// coverage-columns.ts were given. The value still has to be the real one: a
// check that asserts its own idea of the name would pass while the app wrote
// something else.
const REST_DAY = /export const REST_DAY = '([^']+)'/.exec(
  fs.readFileSync('mobile/src/lib/log-rest-day.ts', 'utf8')
)?.[1];

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

console.log('\n  A REST DAY LOOKS LIKE ONE\n');

check('THE TWO ROWS SHE CIRCLED NO LONGER MATCH', () => {
  const rest = activityIcon('Rest day');
  const pullups = activityIcon('Pull-up practice');
  assert.strictEqual(rest, 'rest', `a rest day is drawn as ${rest}`);
  assert.strictEqual(pullups, 'strength', `pull-ups are drawn as ${pullups}`);
  assert.notStrictEqual(rest, pullups, 'they are still the same mark');
  // AND IT IS THE NAME THE APP ACTUALLY WRITES, not a near miss of it. The row
  // is created from this constant, so matching anything else would pass here
  // and fail on her screen.
  assert.ok(REST_DAY, 'REST_DAY could not be read from log-rest-day.ts');
  assert.strictEqual(activityIcon(REST_DAY), 'rest', `the logged name "${REST_DAY}" is not matched`);
  return `"${REST_DAY}" rests, pull-ups lift`;
});

check('AND A RECOVERY RUN IS STILL A RUN', () => {
  // The cost of matching rest words too eagerly. Bare "recovery" is deliberately
  // not matched, because a recovery run is a run and an easy week is not a day
  // off.
  assert.strictEqual(activityIcon('recovery run'), 'run', 'a recovery run became a rest day');
  assert.strictEqual(activityIcon('active recovery'), 'rest');
  assert.strictEqual(activityIcon('rest day'), 'rest');
  assert.strictEqual(activityIcon('day off'), 'rest');
  return 'recovery run runs, active recovery rests';
});

check('AND THE OTHER BODYWEIGHT NAMES LIFT', () => {
  // The same fallback was covering these. None is a named sport, all are
  // strength, and all of them read as "unrecognised" until today.
  for (const name of ['pull ups', 'pull-ups', 'chin-ups', 'push ups', 'press-ups', 'dips']) {
    assert.strictEqual(activityIcon(name), 'strength', `"${name}" is drawn as ${activityIcon(name)}`);
  }
  // Without stealing from the named disciplines, which are matched first.
  assert.strictEqual(activityIcon('ballet'), 'dance');
  assert.strictEqual(activityIcon('bouldering'), 'climb');
  assert.strictEqual(activityIcon('stretching and mobility work'), 'stretch');
  return 'six bodyweight names, and the sports untouched';
});

check('AND AN UNKNOWN ACTIVITY IS STILL A PLAIN MOVEMENT', () => {
  // The fallback has to survive: a wrong confident icon is worse than a neutral
  // one, which is the rule the file already states.
  assert.strictEqual(activityIcon('faffing about'), 'movement');
  assert.strictEqual(activityIcon(''), 'movement');
  assert.strictEqual(activityIcon(null), 'movement');
  return 'unrecognised stays unrecognised';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
