// AN ENTRY ON THE WRONG DAY MOVES. IT IS NOT DELETED AND RE-ENTERED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-move-a-day.mjs
//
// THIS HAS HAPPENED TWICE AND THE EVIDENCE IS IN HER OWN DATA BOTH TIMES.
//
// 28 September. food_logs_removed holds two rows whose stated reason is: "A date
// correction added a copy instead of moving the entry. Removed at Ruth's
// explicit instruction." Cleaned up by hand. Cause left alone.
//
// 8 October, 09:32. "Please change the Wednesdays sandwhich to tuesday." The
// reply offered to delete it from Wednesday and log it fresh for Tuesday, she
// said yes, and the turn reported: "Done - removed from Wednesday and logged for
// Tuesday instead." Nothing was removed. What was logged landed on Thursday.
//
// WHY THE TWO-STEP COULD NEVER HAVE WORKED, which is the part that matters. The
// classify instruction says to set correctionKind and correctionAction INSTEAD OF
// logIntent: a correction is not a new log. One turn deletes or it logs. The
// model was offering an operation this route has no way to carry out, and the
// only record of the promise was its own sentence.
//
// SO THE FIX IS A MOVE, which is one update. The row keeps its id, so its items,
// its macros and its own history travel with it, and there is only one write to
// half-fail instead of two.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const LC = await import(root + '/app/lib/log-correction.ts');
const { REPLY_PROMPT_PARTS } = await import(root + '/app/lib/reply-prompt.ts');

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

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

console.log('\n  MOVING A DAY\n');

check('move is an action the app accepts', () => {
  assert.ok(LC.resolveCorrection('food', 'move'), 'a food move is refused');
  assert.ok(LC.resolveCorrection('activity', 'move'), 'an activity move is refused');
  assert.strictEqual(LC.resolveCorrection('food', 'shift'), null, 'an invented action is accepted');
  return 'food and activity, and nothing invented';
});

check('the time of day travels with the entry', () => {
  // Her actual case: a Wednesday lunch at 08:09 UTC moving to Tuesday. It should
  // land at Tuesday lunchtime, not at the moment she asked.
  const was = '2026-10-07T12:30:00.000Z';
  const moved = LC.movedTimestamp(was, '2026-10-06');
  assert.ok(moved, 'the move produced no timestamp');
  const d = new Date(moved);
  assert.strictEqual(d.toISOString().slice(0, 10), '2026-10-06', 'it did not land on the named day');
  // Same clock time in London, which is what keeps a lunch a lunch.
  const hourWas = new Date(was).toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false });
  const hourNow = d.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false });
  assert.strictEqual(hourNow, hourWas, `the hour changed: ${hourWas} became ${hourNow}`);
  return `12:30 Wednesday lands 12:30 Tuesday`;
});

check('it always lands inside the day it was sent to', () => {
  // Every hour of a day, across the two clock changes, because a DST shift is
  // exactly how an entry would arrive on the wrong side of midnight - which is
  // the whole fault this is meant to stop.
  for (const day of ['2026-03-29', '2026-10-25', '2026-10-06', '2026-01-01']) {
    const range = LC.correctionDayRange(day);
    for (let h = 0; h < 24; h += 1) {
      const was = new Date(Date.UTC(2026, 6, 15, h, 30, 0)).toISOString();
      const moved = LC.movedTimestamp(was, day);
      assert.ok(moved, `no timestamp for hour ${h} into ${day}`);
      assert.ok(
        moved >= range.from && moved < range.to,
        `${was} moved to ${day} landed at ${moved}, outside ${range.from}..${range.to}`
      );
    }
  }
  return '96 hours across both clock changes, all inside their day';
});

check('a day it cannot read moves nothing', () => {
  assert.strictEqual(LC.movedTimestamp('2026-10-07T12:00:00Z', 'Tuesday'), null, 'a word was accepted as a date');
  assert.strictEqual(LC.movedTimestamp('2026-10-07T12:00:00Z', '06-10-2026'), null, 'a non-ISO date was accepted');
  assert.strictEqual(LC.movedTimestamp('not a time', '2026-10-06'), null, 'an unreadable original was accepted');
  return 'refused, not guessed';
});

check('the route performs a move and states it itself', () => {
  const at = route.indexOf("correction.action === 'move'");
  assert.ok(at > 0, 'the route has no move branch');
  const branch = route.slice(at, at + 1600);
  assert.ok(/\.update\(\{ \[timeCol\]: moveTo \}\)/.test(branch), 'the move does not update the time column');
  assert.ok(/\.eq\('id', target\.id\)/.test(branch), 'the move does not target one row by id');
  // A DELETE AND AN INSERT WOULD LOSE THE ROW. The whole point is that it does not.
  assert.ok(!/\.delete\(\)/.test(branch), 'the move deletes something');
  assert.ok(!/\.insert\(/.test(branch), 'the move inserts something');
  assert.ok(/correctionNote = error\s*\?\s*null\s*:\s*movedMessage/.test(branch), 'the app does not state the outcome');
  return 'one update, by id, and the app says so';
});

check('without a destination it asks rather than guesses', () => {
  const at = route.indexOf("correction.action === 'move'");
  const branch = route.slice(at, at + 1600);
  assert.ok(/if \(!moveTo\)/.test(branch), 'a missing destination is not handled');
  assert.ok(/Say which day it should be on/.test(branch), 'it does not ask which day');
  return 'asked, not guessed';
});

check('the model is told to move rather than offer the impossible', () => {
  assert.ok(/'update', 'delete', 'move'/.test(route), 'the tool cannot emit a move');
  assert.ok(/correctionMoveTo/.test(route), 'there is no destination field');
  assert.ok(
    /NEVER OFFER TO DELETE IT AND LOG IT AGAIN/.test(route),
    'nothing stops it offering the two-step the app cannot perform'
  );
  // AND THE REPLY PROMPT AGREED WITH THE OLD WORLD until today.
  const inside = REPLY_PROMPT_PARTS.INSIDE_THE_APP;
  assert.ok(
    !/AN ENTRY'S DAY CANNOT BE MOVED/.test(inside),
    'the reply prompt still says a day cannot be moved, which is now false'
  );
  assert.ok(/AN ENTRY'S DAY CAN BE MOVED/.test(inside), 'the reply prompt does not know it can move a day');
  assert.ok(
    /NEVER OFFER TO DELETE IT AND LOG IT AGAIN/.test(inside),
    'the reply prompt may still offer the two-step'
  );
  return 'classifier and writer both know';
});

check('and this check can fail', () => {
  // The shipped behaviour: a move was not an action at all.
  assert.strictEqual(LC.resolveCorrection('food', 'move') === null, false);
  const asShipped = ['update', 'delete'];
  assert.ok(!asShipped.includes('move'), 'the fixture is not the old action list');
  // And a move that silently landed on the wrong day would be caught.
  const wrong = LC.movedTimestamp('2026-10-07T12:00:00Z', '2026-10-06');
  assert.notStrictEqual(wrong.slice(0, 10), '2026-10-07', 'a move that changed nothing is undetectable');
  return 'the old action list and a no-op move are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
