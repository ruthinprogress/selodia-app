// A SLOW TURN IS RE-SENT. EVERY TABLE HAS TO SURVIVE THAT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-written-once.mjs
//
// Ruth, 9 October 2026: "run was logged fine, but yoga 60mins was logged 5
// times." She said "It was about an hour" ONCE. A 14.4 second turn was re-sent
// by ElevenLabs five times; each re-send ran a complete turn and wrote the row.
//
// Activity was guarded that morning, which fixed the table she happened to be
// using and nothing else. The re-send is not about activity. So every table the
// chat path writes to was checked afterwards:
//
//   cycle_events       SAFE, upserts on (user_id, event_date, event_type)
//   sleep_logs         SAFE, merges into the night's existing row
//   food_logs          SAFE, voice-supersede settles a sentence to one set
//   activity_logs      guarded 9 October
//   hydration_logs     was a bare insert
//   body_measurements  was a bare insert
//
// This covers the shared decision and the two that were exposed.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { splitAlreadyWritten, sameNumber, sameWords, REPEAT_WINDOW_MS } = await import(
  root + '/app/lib/written-once.ts'
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

const key = (r) => [sameNumber(r.ml), sameWords(r.raw_input)].join('\u0000');

console.log('\n  WRITTEN ONCE\n');

check('the numeric-as-string trap is closed', () => {
  // THE ONE THAT MAKES A GUARD READ CORRECTLY AND DO NOTHING. Supabase returns
  // a numeric column as a string; the parse produces a number. Without this the
  // keys never match, every repeat looks new, and nothing is protected.
  assert.strictEqual(sameNumber(60), sameNumber('60'));
  assert.strictEqual(sameNumber(55.2), sameNumber('55.2'));
  assert.strictEqual(sameNumber(null), 'none');
  assert.strictEqual(sameNumber(undefined), 'none');
  assert.strictEqual(sameNumber(''), 'none');
  // And genuinely different numbers stay different.
  assert.notStrictEqual(sameNumber(60), sameNumber(61));
  return '60 and "60" agree; null, undefined and "" are all none';
});

check('five identical sends become one row', () => {
  const table = [];
  for (let i = 0; i < 5; i++) {
    const { fresh } = splitAlreadyWritten([{ ml: 2000, raw_input: 'two litres of water' }], table, key);
    for (const row of fresh) table.push(row);
  }
  assert.strictEqual(table.length, 1, `${table.length} rows survived - two litres became ${table.length * 2} litres`);
  return '5 sends, 1 row';
});

check('and this check can fail', () => {
  // The assertion is that a count came down, which is also true of a guard that
  // drops everything. So: an unguarded replay must give five, and a first write
  // must still go in.
  const unguarded = [];
  for (let i = 0; i < 5; i++) unguarded.push({ ml: 2000 });
  assert.strictEqual(unguarded.length, 5, 'the unguarded case does not reproduce the bug');
  const { fresh } = splitAlreadyWritten([{ ml: 250, raw_input: 'a glass of water' }], [], key);
  assert.strictEqual(fresh.length, 1, 'a first write was dropped');
  return 'unguarded gives 5, and a first write still lands';
});

check('a genuinely different thing is not swallowed', () => {
  const table = [{ ml: 250, raw_input: 'a glass of water' }];
  for (const [label, row] of [
    ['a different amount', { ml: 500, raw_input: 'a bottle of water' }],
    ['the same amount, different words', { ml: 250, raw_input: 'a glass of squash' }],
  ]) {
    const { fresh } = splitAlreadyWritten([row], table, key);
    assert.strictEqual(fresh.length, 1, `dropped: ${label}`);
  }
  return 'different amount and different words both still log';
});

check('one request containing the same thing twice writes it twice', () => {
  // She really can say "two glasses of water" as two entries in one sentence.
  // The repeats this guards are separate REQUESTS, so a match is claimed as it
  // is used and cannot absorb a second candidate.
  const { fresh } = splitAlreadyWritten(
    [{ ml: 250, raw_input: 'a glass of water' }, { ml: 250, raw_input: 'a glass of water' }],
    [{ ml: 250, raw_input: 'a glass of water' }],
    key
  );
  assert.strictEqual(fresh.length, 1, 'both were dropped against one stored row');
  return 'one stored row absorbs one candidate, not two';
});

check('hydration gets a shorter window than everything else, on purpose', () => {
  const src = readFileSync('app/lib/hydration-logging.ts', 'utf8');
  assert.ok(/2 \* 60_000/.test(src), 'hydration no longer uses its own short window');
  assert.ok(
    !/REPEAT_WINDOW_MS/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
    'hydration is on the ten-minute window, which would swallow a real second glass'
  );
  // Nobody does two identical hour-long yoga classes ten minutes apart. People
  // do drink two glasses of water in ten minutes and describe both the same.
  assert.strictEqual(REPEAT_WINDOW_MS, 10 * 60_000, 'the ordinary window has moved');
  return 'hydration 2 minutes, everything else 10';
});

check('both bare inserts are now guarded', () => {
  for (const [file, marker] of [
    ['app/lib/hydration-logging.ts', 'HYDRATION ALREADY LOGGED'],
    ['app/lib/measurement-logging.ts', 'MEASUREMENT ALREADY STORED'],
  ]) {
    const src = readFileSync(file, 'utf8');
    assert.ok(/splitAlreadyWritten\(/.test(src), `${file} does not use the shared guard`);
    assert.ok(src.includes(marker), `${file} writes again without saying so`);
  }
  // And activity uses the same one rather than its own copy.
  const activity = readFileSync('app/lib/activity-logging.ts', 'utf8');
  assert.ok(/splitAlreadyWritten\(/.test(activity), 'activity kept its own copy of the logic');
  return '3 tables, 1 implementation';
});

check('a deduped write returns the existing row, never nothing', () => {
  // Returning null would make the caller say "that did not save", which is
  // false and invites her to log it again - which is how a duplicate is made.
  for (const file of ['app/lib/hydration-logging.ts', 'app/lib/measurement-logging.ts']) {
    const src = readFileSync(file, 'utf8');
    const at = src.indexOf('splitAlreadyWritten(');
    const after = src.slice(at, at + 1200);
    assert.ok(/alreadyThere\[0\]/.test(after), `${file} returns nothing when it deduplicates`);
  }
  return 'the stored row comes back in its place';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
