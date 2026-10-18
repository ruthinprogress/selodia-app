// THE WEEK IS A TEMPLATE, AND A LOG HAPPENS AT THE TIME THE PLAN SAYS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-week-is-not-a-list.mjs
//
// Two faults Ruth found by using the thing, minutes apart, both of them the
// app disagreeing with something it had already written down about itself.
//
//   "I tested the 'log it' button and it placed a tick next to the card in week
//    view. Thats not good. Its a template not a to do list. The movement log
//    shows whats logged."
//
// The week screen says, six lines under those cards: "This is the shape of your
// week, not a score. Nothing here is ever marked done or missed." A tick is a
// mark of done. Both statements were on one screenful.
//
//   "it said 12:00 instead of 7.30"
//
// Her ballet card says 19:30 on its face. The log stored noon, because noon was
// the fallback for a day she picked rather than a moment that happened - and it
// was being applied even when the app already knew the hour. day-time.ts had
// the rule written down years of decisions deep: inventing a clock she never
// said, and showing it back to her, is the app putting words in her mouth.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const { clockMinutes } = await import(
  pathToFileURL(path.join(process.cwd(), 'mobile', 'src', 'lib', 'day-time.ts')).href
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

const week = fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8');
const plans = fs.readFileSync('mobile/src/app/(tabs)/plans.tsx', 'utf8');

console.log('\n  A TEMPLATE, NOT A TO-DO LIST\n');

check('NOTHING IN THE WEEK IS MARKED DONE', () => {
  // The tick, on either card type. Stripped of comments first, because the
  // reason it is gone is written in one.
  const visible = week
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
  assert.ok(
    !/checkmark/i.test(visible),
    'a tick is back on a week card, which the screen itself says never happens'
  );
  assert.ok(
    !/\{logged && </.test(visible),
    'something is rendered only when logged, which is a done mark by another name'
  );
  return 'no tick on a pill or a card';
});

check('and the screen still says so in its own words', () => {
  // The sentence that makes the tick a contradiction rather than a preference.
  // If this line is ever deleted, the check above loses its argument.
  assert.ok(
    /Nothing here is ever marked done or missed/.test(week),
    'the week no longer says it is not a score, so nothing contradicts a tick'
  );
  return 'the promise is still on the screen';
});

check('A LOG LANDS AT THE TIME THE CARD SHOWS', () => {
  assert.ok(
    /input\.plannedMinutes != null/.test(plans),
    'writeLog ignores the plan time again and stores noon for everything'
  );
  assert.ok(
    /at\.setHours\(12, 0, 0, 0\)/.test(plans),
    'the noon fallback is gone - a log at midnight lands on the previous day'
  );
  // Both routes into writeLog, because only one of them was wrong first.
  const calls = plans.match(/plannedMinutes:/g) ?? [];
  assert.ok(calls.length >= 2, `only ${calls.length} path supplies the time; both must`);
  return 'single card and whole week both pass it';
});

check('AND AN INVENTED HOUR CAN NEVER BECOME A LOGGED ONE', () => {
  // THE TRAP, and it is the reason clockMinutes exists instead of callers
  // reading PlannedTime.minutes. "Evening" carries a nominal sorting bucket so
  // the week can be put in order. Logged, it would be a time nobody named.
  assert.strictEqual(clockMinutes('19:30'), 1170, 'a stated clock time is lost');
  assert.strictEqual(clockMinutes('7pm'), 1140, 'her own wording is not read as a time');
  assert.strictEqual(clockMinutes('around 9'), 540, 'a hedge is still a time she named');
  assert.strictEqual(clockMinutes('evening'), null, 'a part of the day became a clock time');
  assert.strictEqual(clockMinutes('after the school run'), null, 'a phrase became a clock time');
  assert.strictEqual(clockMinutes(null), null);
  assert.strictEqual(clockMinutes(''), null);
  return 'clock yes, bucket never';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
