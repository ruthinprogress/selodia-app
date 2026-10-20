// THE FLOWER DIVIDES BY DAYS THAT HAVE HAPPENED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-flower-window.mjs
//
// Ruth, 20 October 2026, on why the drawing felt like a score:
//
//   "What if it's always the last 7 days or last 30 days as default view
//    starting from the currect day. That way its just the shape of what
//    happened, as opposed of implying that more needs doing this week/month
//    with all the empty petals if its monday or 1st of the month."
//
// SHE FOUND AN ARITHMETIC FAULT, not a preference, and that is what this file
// is here to stop coming back. Coverage is a sum over a target and the target
// scales with the window's length. A calendar window reported its FULL length
// whatever day it was - seven for "this week" on a Monday morning, thirty-one
// for "this month" on the 1st - so one elapsed day was measured against a whole
// week or a whole month of work.
//
// The drawing was not saying "you have done little this week". It was saying
// "this week has not happened yet", in the visual language of "you have done
// little", on a screen about somebody's body.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const { flowerRange, MODE_DAYS, MAX_BACK } = await import(
  pathToFileURL(path.join(process.cwd(), 'mobile', 'src', 'lib', 'flower-range.ts')).href
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

const range = fs.readFileSync('mobile/src/lib/flower-range.ts', 'utf8');
const section = fs.readFileSync('mobile/src/components/balance-flower-section.tsx', 'utf8');

const days = (r) => Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000);

console.log('\n  A WINDOW THAT HAS ALREADY HAPPENED\n');

check('THE WINDOW IS NEVER LONGER THAN THE TIME IN IT', () => {
  // THE FAULT ITSELF. Monday the 19th: a calendar week reported 7 days when one
  // had happened. Every day of the week must now give the same honest answer.
  for (let d = 19; d <= 25; d += 1) {
    const now = new Date(2026, 9, d, 9, 0);
    const r = flowerRange('days7', 0, now);
    assert.strictEqual(r.days, 7, `days7 reported ${r.days} days on the ${d}th`);
    assert.strictEqual(days(r), 7, `the window spans ${days(r)} days on the ${d}th`);
    // IT ENDS TODAY, AND THIS IS THE ASSERTION THAT MATTERS.
    //
    // Length alone does not catch the fault: a Monday-anchored week also spans
    // seven days and also reports seven. What made it wrong was that five of
    // those days had not happened yet. Found by mutating the window back to
    // Monday-anchoring and watching every other check in this file pass.
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    assert.strictEqual(
      r.to.getTime(),
      endOfToday.getTime(),
      `on the ${d}th the window runs to ${r.to.toDateString()}, which is not the end of today`
    );
    assert.ok(r.from <= now, `the window starts after now on the ${d}th`);
  }
  return 'seven days, every day of the week';
});

check('AND THE SAME ON THE FIRST OF A MONTH', () => {
  // The worse half: one day against thirty-one.
  const first = new Date(2026, 10, 1, 9, 0);
  const r = flowerRange('days30', 0, first);
  assert.strictEqual(r.days, 30, `days30 reported ${r.days} days on the 1st`);
  assert.strictEqual(days(r), 30, 'the thirty-day window is not thirty days long');
  // Ends today, not at the end of the month.
  assert.strictEqual(
    r.to.getTime(),
    new Date(2026, 10, 2).getTime(),
    'the thirty-day window runs past today into a month that has not happened'
  );
  // And so it reaches BACK rather than forward.
  assert.strictEqual(r.from.getTime(), new Date(2026, 9, 3).getTime(), 'it does not reach back 30 days');
  return 'thirty days on the 1st, not one';
});

check('EVERY WINDOW IS THE SAME LENGTH, SO TWO DRAWINGS COMPARE', () => {
  // A calendar month could not promise this: thirty days against thirty-one is
  // a different target for the same effort.
  const now = new Date(2026, 9, 20, 9, 0);
  for (const mode of ['days7', 'days30']) {
    const lengths = new Set();
    for (let back = 0; back <= 5; back += 1) {
      const r = flowerRange(mode, back, now);
      lengths.add(days(r));
      assert.strictEqual(r.days, MODE_DAYS[mode], `${mode} back ${back} reported ${r.days}`);
    }
    assert.strictEqual(lengths.size, 1, `${mode} windows are not all the same length`);
  }
  return 'identical lengths, both modes';
});

check('PAGING BACK NEVER OVERLAPS AND NEVER LEAVES A GAP', () => {
  // Half-open and butted together: a session belongs to exactly one window.
  const now = new Date(2026, 9, 20, 9, 0);
  for (const mode of ['days7', 'days30']) {
    for (let back = 0; back < 4; back += 1) {
      const nearer = flowerRange(mode, back, now);
      const older = flowerRange(mode, back + 1, now);
      assert.strictEqual(
        older.to.getTime(),
        nearer.from.getTime(),
        `${mode} leaves a gap or overlaps between ${back} and ${back + 1}`
      );
    }
  }
  return 'butted together, both modes';
});

check('AND IT CANNOT PAGE INTO THE FUTURE', () => {
  const now = new Date(2026, 9, 20, 9, 0);
  const here = flowerRange('days7', 0, now);
  // Negative and over-large steps are clamped rather than trusted.
  assert.strictEqual(flowerRange('days7', -5, now).to.getTime(), here.to.getTime());
  const far = flowerRange('days7', 999, now);
  const limit = flowerRange('days7', MAX_BACK, now);
  assert.strictEqual(far.from.getTime(), limit.from.getTime(), 'paging past the limit is not clamped');
  return `clamped at 0 and ${MAX_BACK}`;
});

check('THE LABEL DESCRIBES A STRETCH THAT HAPPENED', () => {
  // "this week" invited the reading she objected to: that the week is a thing
  // with a shape you are filling.
  const now = new Date(2026, 9, 20, 9, 0);
  assert.strictEqual(flowerRange('days7', 0, now).label, 'the last 7 days');
  assert.strictEqual(flowerRange('days30', 0, now).label, 'the last 30 days');
  // COMMENTS STRIPPED. The first version of this matched the header comment,
  // which quotes her own words about "this week/month" - the third time this
  // week a check has read its own prose. The code is the thing being tested.
  const code = range.replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/label:[^;]*this (week|month)/.test(code),
    'a calendar label is still produced'
  );
  const older = flowerRange('days7', 1, now).label;
  assert.ok(/^the 7 days to /.test(older), `a stepped-back window reads "${older}"`);
  return `"the last 7 days", then "${older}"`;
});

check('AND THE CONTROL SAYS DAYS, NOT WEEKS', () => {
  assert.ok(/'7 days' : '30 days'/.test(section), 'the toggle still offers Week and Month');
  assert.ok(!/'Week' : 'Month'/.test(section), 'the old labels are still there');
  // Shorter labels, which also retires the clipping that started this.
  assert.ok(/days7/.test(section) && /days30/.test(section), 'the modes are still named for calendars');
  return '7 days / 30 days';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
