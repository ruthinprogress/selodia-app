// ONE ACTIVITY, ONE ROW.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-activity-once.mjs
//
// Ruth, 9 October 2026: "run was logged fine, but yoga 60mins was logged 5
// times." She said "It was about an hour" once. Five identical rows landed.
//
// The rows below are the real ones, copied from activity_logs. The timings
// below are the real turns, copied from model_usage. Both are here because a
// check written from a description of a bug tends to test the description.
//
// WHAT THIS HAS TO PROVE, and it is not that a guard exists. Two guards
// already existed on 9 October and both let this through: voice-supersede's
// `continues()` wants the repeat to be LONGER, and the adapter's check asks
// whether she heard the last answer, which she had. Reading either one would
// have told you the case was covered. So this check runs the decision against
// the actual repeats and counts what survives.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { activityRepeatKey, splitAlreadyLogged, ACTIVITY_REPEAT_WINDOW_MS } = await import(
  root + '/app/lib/activity-logging.ts'
);

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

// The five rows as they are in her table, oldest first.
const THE_FIVE = [
  { id: 'ef555432', created_at: '2026-10-09T09:41:40.058Z', activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' },
  { id: '05e38c5e', created_at: '2026-10-09T09:41:48.041Z', activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' },
  { id: 'd660f34f', created_at: '2026-10-09T09:42:09.924Z', activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' },
  { id: 'dd42c6e0', created_at: '2026-10-09T09:42:13.139Z', activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' },
  { id: '489033a7', created_at: '2026-10-09T09:42:16.642Z', activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' },
];

console.log('\n  ONE ACTIVITY, ONE ROW\n');

check('the five real yoga rows become one', () => {
  // Replayed the way they arrived: five separate requests, each reading back
  // what the ones before it wrote.
  const table = [];
  for (const incoming of THE_FIVE) {
    const { fresh } = splitAlreadyLogged([incoming], table);
    for (const row of fresh) table.push(row);
  }
  assert.strictEqual(
    table.length,
    1,
    `${table.length} row(s) survived, expected 1 - this is the bug she reported`
  );
  return `5 requests in 36s, 1 row`;
});

check('and this check can fail', () => {
  // The whole check is an assertion that a count came down, and a count comes
  // down for a guard that drops everything too. So: an unguarded replay must
  // produce five, and a real one must still log something.
  const unguarded = [];
  for (const incoming of THE_FIVE) unguarded.push(incoming);
  assert.strictEqual(unguarded.length, 5, 'the unguarded replay does not reproduce the bug');

  const { fresh } = splitAlreadyLogged(
    [{ activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' }],
    []
  );
  assert.strictEqual(fresh.length, 1, 'a first-ever activity was dropped');
  return 'unguarded gives 5, and a first log still writes';
});

check('a genuinely different activity is not swallowed', () => {
  const table = [THE_FIVE[0]];
  for (const [label, row] of [
    ['a different length', { activity_type: 'yoga', duration_min: 30, raw_input: 'a 30 minute yoga class' }],
    ['a different activity', { activity_type: 'running', duration_min: 60, raw_input: 'a 60 minute run' }],
    ['the same words, different parse', { activity_type: 'pilates', duration_min: 60, raw_input: 'a 60 minute yoga class' }],
    ['no duration at all', { activity_type: 'rest', duration_min: null, raw_input: 'rest day today' }],
  ]) {
    const { fresh } = splitAlreadyLogged([row], table);
    assert.strictEqual(fresh.length, 1, `dropped: ${label}`);
  }
  return '4 different activities, all still logged';
});

check('one sentence, two activities, one of them a repeat', () => {
  // The reason this works row by row rather than all or nothing. She says
  // "an hour of yoga and then a 20 minute walk"; the yoga is already in from
  // the retry, the walk is not.
  const table = [THE_FIVE[0]];
  const { fresh, alreadyThere } = splitAlreadyLogged(
    [
      { activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' },
      { activity_type: 'walking', duration_min: 20, raw_input: 'a 60 minute yoga class' },
    ],
    table
  );
  assert.strictEqual(fresh.length, 1, 'the walk was dropped with the yoga');
  assert.strictEqual(fresh[0].activity_type, 'walking');
  assert.strictEqual(alreadyThere.length, 1, 'the yoga was not recognised as already logged');
  return 'walk logged, yoga not written twice';
});

check('what she is told is that it IS logged', () => {
  // A deduped retry must hand its caller the existing row, not an empty list.
  // Empty reads as "not logged" all the way up to what she hears, and the
  // yoga is logged - saying otherwise would be both false and alarming.
  const { fresh, alreadyThere } = splitAlreadyLogged([THE_FIVE[1]], [THE_FIVE[0]]);
  assert.strictEqual(fresh.length, 0);
  assert.deepStrictEqual(alreadyThere.map((r) => r.id), ['ef555432']);
  return 'the existing row comes back in its place';
});

check('wording that differs only in spacing or case is the same words', () => {
  const a = activityRepeatKey({ activity_type: 'Yoga', duration_min: 60, raw_input: 'A 60  Minute Yoga Class ' });
  const b = activityRepeatKey({ activity_type: 'yoga', duration_min: 60, raw_input: 'a 60 minute yoga class' });
  assert.strictEqual(a, b, 'case and spacing split one activity into two');
  // And a numeric 60 is the same as a numeric-string 60, because Supabase
  // returns numerics as strings and the candidate rows hold numbers. This is
  // the one that would have silently disabled the whole guard in production.
  assert.strictEqual(
    activityRepeatKey({ activity_type: 'yoga', duration_min: 60, raw_input: 'x' }),
    activityRepeatKey({ activity_type: 'yoga', duration_min: '60', raw_input: 'x' }),
    'a numeric from the database does not match a number from the parse'
  );
  return 'case, spacing, and numeric-as-string all agree';
});

check('the window is minutes, not a day', () => {
  // Two real thirty-minute runs in one day both belong in the table.
  assert.ok(ACTIVITY_REPEAT_WINDOW_MS <= 15 * 60_000, 'the window has grown past a quarter of an hour');
  assert.ok(ACTIVITY_REPEAT_WINDOW_MS >= 60_000, 'the window is too short to cover a slow retry');
  // The observed retries spanned 36 seconds from her sentence; the slowest
  // turn that caused them was 14.4s. A minute would have been enough, ten
  // leaves room for worse.
  const spread = new Date(THE_FIVE[4].created_at) - new Date(THE_FIVE[0].created_at);
  assert.ok(ACTIVITY_REPEAT_WINDOW_MS > spread, `the real repeats spanned ${spread}ms`);
  return `${ACTIVITY_REPEAT_WINDOW_MS / 60_000} min, against ${spread / 1000}s of real repeats`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
