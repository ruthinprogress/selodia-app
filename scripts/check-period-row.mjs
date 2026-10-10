// THE PERIOD ROW HAS THREE STATES, AND ONE OF THEM USED NOT TO EXIST.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-period-row.mjs
//
// Ruth, 9 October 2026: "There is something missing, and that's how to say when
// the period ended."
//
// The row was two buttons side by side - "Started sat 1 aug" and "Ended sat 1
// aug" - which are not states, they are two writes. It said nothing about where
// she actually was, and offered to end a period whether or not one was running.
//
// From the build spec:
//   NOT BLEEDING  "Period started today". That is the whole row.
//   BLEEDING      "Day 3 of your period", then "It's stopped" and "Choose the day".
//   JUST ENDED    "That cycle is closed. 5 days." Then back to the first state.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { bleedState, lastBleedLength, recentDays, CHOOSABLE_DAYS } = await import(
  root + '/mobile/src/lib/period-row.ts'
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
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const start = (d) => ({ event_date: d, event_type: 'period_start' });
const end = (d) => ({ event_date: d, event_type: 'period_end' });

console.log('\n  THE PERIOD ROW HAS THREE STATES\n');

check('a start with no end is an open period, counted from day one', () => {
  const s = bleedState([start('2026-10-08')], '2026-10-10');
  assert.strictEqual(s.state, 'bleeding');
  assert.strictEqual(s.dayOfPeriod, 3);
  // The day it starts is day 1, not day 0.
  assert.strictEqual(bleedState([start('2026-10-10')], '2026-10-10').dayOfPeriod, 1);
  return 'day 3 on the third day';
});

check('an end ON the start day closes it', () => {
  // A period that started and stopped the same day is over. Requiring the end
  // to come strictly later would leave it open for ever.
  const s = bleedState([start('2026-10-10'), end('2026-10-10')], '2026-10-10');
  assert.strictEqual(s.state, 'not-bleeding');
  return 'same-day end is an end';
});

check('a start in the future is not bleeding now', () => {
  // Unreachable from the screen, which offers today and the fortnight behind
  // it, but reachable from chat: "my period starts tomorrow". Day 0 of a
  // period is not a sentence anyone should be shown.
  const s = bleedState([start('2026-10-20')], '2026-10-10');
  assert.strictEqual(s.state, 'not-bleeding');
  return 'tomorrow is not today';
});

check('an older end does not close a newer start', () => {
  // The ordinary case after months of use: every past period has an end, and
  // the current one does not.
  const events = [start('2026-09-01'), end('2026-09-05'), start('2026-10-08')];
  const s = bleedState(events, '2026-10-10');
  assert.strictEqual(s.state, 'bleeding');
  assert.strictEqual(s.dayOfPeriod, 3);
  return 'September closed, October open';
});

check('the just-ended line gets a length, inclusive of both days', () => {
  const n = lastBleedLength([start('2026-10-01'), end('2026-10-05')]);
  assert.strictEqual(n, 5, 'the 1st to the 5th is five days');
  // A one-day period lasted one day, not nought.
  assert.strictEqual(lastBleedLength([start('2026-10-01'), end('2026-10-01')]), 1);
  return '1 to 5 Oct reads as 5 days';
});

check('the length comes from the period that just closed, not the first one ever', () => {
  const events = [start('2026-08-01'), end('2026-08-03'), start('2026-10-01'), end('2026-10-05')];
  assert.strictEqual(lastBleedLength(events), 5, 'it reached back to August');
  return 'the most recent closed period';
});

check('"Choose the day" offers today and the fortnight behind it', () => {
  const days = recentDays('2026-10-10', CHOOSABLE_DAYS);
  assert.strictEqual(days.length, CHOOSABLE_DAYS);
  assert.strictEqual(days[0], '2026-10-10', 'today is not first');
  assert.strictEqual(days[CHOOSABLE_DAYS - 1], '2026-09-27');
  // It must cross a month boundary correctly, which is where naive date maths dies.
  ok(days.includes('2026-09-30') && days.includes('2026-10-01'), 'the month boundary is wrong');
  return `${CHOOSABLE_DAYS} days, back to 27 Sept`;
});

check('the screen actually renders all three states', () => {
  // The library can be perfect and the screen can still draw two buttons. This
  // check exists because that is exactly what happened to SYMPTOM_GROUPS.
  const src = readFileSync('mobile/src/app/(tabs)/log/cycle.tsx', 'utf8');
  ok(/Period started today/.test(src), 'the not-bleeding state is missing');
  ok(/Day \{bleed\.dayOfPeriod\} of your period/.test(src), 'the bleeding heading is missing');
  ok(/It&apos;s stopped|It's stopped/.test(src), '"It\'s stopped" is missing');
  ok(/Choose the day/.test(src), '"Choose the day" is missing');
  ok(/That cycle is closed\./.test(src), 'the just-ended state is missing');
  // And the row it replaced is gone for good.
  ok(!/Started \{human/.test(src), 'the old two-button row is still there');
  return 'all three, and the old row gone';
});

check('nothing on these screens lowercases a date', () => {
  // "Started sat 1 aug" and "Save sat 1 aug" reached her phone because every
  // call site downcased the result of human(). A weekday and a month are proper
  // nouns whatever precedes them; midSentence() exists for the cases that
  // genuinely read better lowered, and it only lowers Today and Yesterday.
  for (const f of [
    'mobile/src/app/(tabs)/log/cycle.tsx',
    'mobile/src/app/(tabs)/log/cycle-day.tsx',
  ]) {
    const src = readFileSync(f, 'utf8');
    ok(!/human\([^)]*\)\.toLowerCase\(\)/.test(src), `${f} lowercases a date`);
  }
  return 'no human(...).toLowerCase() anywhere';
});

check('and this check can fail', () => {
  // Prove each shape is detected rather than merely absent.
  assert.strictEqual(bleedState([], '2026-10-10').state, 'not-bleeding');
  assert.strictEqual(lastBleedLength([start('2026-10-01')]), null, 'an open period reported a length');
  assert.strictEqual(lastBleedLength([]), null);
  ok(/human\(day\)\.toLowerCase\(\)/.test('Save ${human(day).toLowerCase()}'), 'the lowercase fixture is not detected');
  return 'empty input, open period and the old lowercase form all read correctly';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
