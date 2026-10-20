// WHERE THINGS ARE, AND WHICH STRETCH THE FLOWER IS DRAWING.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-nav-and-flower-range.mjs
//
// THE RESTRUCTURE (Ruth, 7 October 2026). Me replaces the Almanac in the five
// tabs, Today becomes Now, the Almanac moves to More under the Body Manual, and
// the flower moves to Now with a week and a month view instead of a fixed six
// weeks.
//
// THE PART THAT GOES STALE SILENTLY is the paragraph that tells the model what
// the screens are. It has been wrong twice this week already: once naming a log
// editor that was never built, and once still calling a page "Data and export"
// an hour after it was renamed. A tab rename is the same fault with five times
// the surface.

import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const RANGE = await import(root + '/mobile/src/lib/flower-range.ts');
const { evenlySpread } = await import(root + '/mobile/src/lib/health-flower.ts');
const { APP_STRUCTURE_PROMPT_BLOCK } = await import(root + '/app/lib/app-structure.ts');

const tabs = readFileSync('mobile/src/components/app-tabs.tsx', 'utf8');
const menu = readFileSync('mobile/src/app/settings/index.tsx', 'utf8');

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

console.log('\n  WHERE THINGS ARE\n');

check('the five tabs are the five she named', () => {
  const labels = [...tabs.matchAll(/<NativeTabs\.Trigger\.Label>([^<]+)</g)].map((m) => m[1]);
  assert.deepStrictEqual(labels, ['Chat', 'Log', 'Now', 'Plans', 'Me'], 'the tab bar is not hers');
  // THE NAME OF A TAB IS THE NAME OF A ROUTE, because these are real native
  // tabs reading the file tree. A label without its file is a blank tab.
  for (const name of ['index', 'log', 'now', 'plans', 'me']) {
    assert.ok(new RegExp(`name="${name}"`).test(tabs), `the ${name} trigger is missing`);
  }
  assert.ok(existsSync('mobile/src/app/(tabs)/me.tsx'), 'the Me route does not exist');
  assert.ok(existsSync('mobile/src/app/(tabs)/now/index.tsx'), 'the Now route does not exist');
  assert.ok(!existsSync('mobile/src/app/(tabs)/almanac.tsx'), 'the old Almanac tab is still a route');
  assert.ok(!existsSync('mobile/src/app/(tabs)/today'), 'the old Today folder is still a route');
  return 'Chat, Log, Now, Plans, Me';
});

check('the Almanac is in More, under the Body Manual', () => {
  assert.ok(existsSync('mobile/src/app/settings/almanac.tsx'), 'there is no Almanac screen under settings');
  const bodyAt = menu.indexOf('label="Body Manual"');
  const almanacAt = menu.indexOf('label="Almanac"');
  assert.ok(almanacAt > 0, 'there is no Almanac row on the More menu');
  assert.ok(almanacAt > bodyAt, 'the Almanac is not under the Body Manual, which is where she put it');
  return 'one row below the Body Manual';
});

check('the flower left the Almanac and is on Now', () => {
  const almanac = readFileSync('mobile/src/app/settings/almanac.tsx', 'utf8');
  const now = readFileSync('mobile/src/app/(tabs)/now/index.tsx', 'utf8');
  assert.ok(!/BalanceFlowerSection/.test(almanac), 'the Almanac still draws the flower');
  assert.ok(/BalanceFlowerSection/.test(now), 'Now does not draw the flower');
  assert.ok(/ReportLink/.test(now), 'Now has no way through to the report builder');
  return 'moved, with the report link beside it';
});

check('what the model is told matches what is there', () => {
  const b = APP_STRUCTURE_PROMPT_BLOCK;
  assert.ok(/Chat, Log, Now, Plans and Me/.test(b), 'the prompt still lists the old five tabs');
  assert.ok(!/- TODAY \(/.test(b), 'the prompt still describes a TODAY tab');
  assert.ok(!/- ALMANAC \(/.test(b), 'the prompt still describes the Almanac as a tab');
  assert.ok(/- NOW \(/.test(b) && /- ME \(/.test(b), 'the two new tabs are not described');
  // AND THE ALMANAC IS STILL FINDABLE, just somewhere else. Dropping it from
  // the prompt entirely would be the opposite error.
  assert.ok(/Almanac/.test(b), 'the Almanac has vanished from the prompt rather than moved');
  assert.ok(
    !/health flower for this week/.test(b),
    'the prompt still says the flower shows this week, which is now one of two views'
  );
  return 'five tabs, both new descriptions, Almanac relocated';
});

console.log('\n  WHICH STRETCH\n');

check('A WINDOW ENDS TODAY AND REACHES BACK, 20 October 2026', () => {
  // SUPERSEDES "this week is Monday to Monday" AND "a month is the calendar
  // month". Both were correct for the windows that existed when they were
  // written, and both described the fault Ruth found:
  //
  //   "That way its just the shape of what happened, as opposed of implying
  //    that more needs doing this week/month with all the empty petals if its
  //    monday or 1st of the month."
  //
  // A calendar window reported its FULL length whatever day it was, and the
  // target scales by that - so one elapsed day was measured against a whole
  // week, or a whole month. The window now ends today and reaches back, so the
  // denominator only ever counts days that have happened.
  //
  // The detailed arithmetic lives in check-flower-window.mjs. What is kept
  // here is the contract this file has always guarded: half-open, local, and
  // the right length.
  const now = new Date(2026, 9, 7, 14, 0, 0);
  for (const [mode, length] of [['days7', 7], ['days30', 30]]) {
    const r = RANGE.flowerRange(mode, 0, now);
    assert.strictEqual(r.days, length, `${mode} is not ${length} days`);
    assert.strictEqual(
      r.to.getTime() - r.from.getTime(),
      length * 86_400_000,
      `${mode} does not span ${length} days`
    );
    // Half-open at local midnight after today: a session stamped today is in,
    // and nothing lands in two windows.
    assert.strictEqual(
      r.to.getTime(),
      new Date(2026, 9, 8).getTime(),
      `${mode} does not end at the midnight after today`
    );
    assert.strictEqual(r.to.getHours(), 0, 'the boundary is not local midnight');
  }
  assert.strictEqual(RANGE.flowerRange('days7', 0, now).label, 'the last 7 days');
  // A LEAP YEAR IS NO LONGER SPECIAL, which is the point of a fixed length:
  // thirty days is thirty days in February too.
  assert.strictEqual(RANGE.flowerRange('days30', 0, new Date(2028, 1, 15)).days, 30);
  return 'ends today, reaches back, same length always';
});

check('and the span in weeks matches the days in it', () => {
  // The target scales by this, so a window that claimed more weeks than it
  // holds would set the bar high and draw a thin flower for a full life.
  const now = new Date(2026, 9, 7);
  assert.ok(Math.abs(RANGE.weeksIn(RANGE.flowerRange('days7', 0, now)) - 1) < 1e-9);
  assert.ok(Math.abs(RANGE.weeksIn(RANGE.flowerRange('days30', 0, now)) - 30 / 7) < 1e-9);
  return 'one week, and thirty sevenths';
});

check('there is no future to page into, and a floor to stop at', () => {
  assert.strictEqual(RANGE.canGoForward(0), false, 'forward is live on the current window');
  assert.strictEqual(RANGE.canGoForward(1), true, 'forward is dead one step back');
  assert.strictEqual(RANGE.canGoBack(RANGE.MAX_BACK), false, 'back never stops');
  // Out-of-range input is clamped rather than producing a window in 2019.
  const far = RANGE.flowerRange('week', 999, new Date(2026, 9, 7));
  const limit = RANGE.flowerRange('week', RANGE.MAX_BACK, new Date(2026, 9, 7));
  assert.strictEqual(far.from.getTime(), limit.from.getTime(), 'the floor is not enforced');
  return `floor at ${RANGE.MAX_BACK} windows`;
});

check('every label the range can produce is singular', () => {
  // THE PROMISE health-flower.ts MAKES. One clause replaced a lookup of one
  // sentence per window, and it is only safe because "has been" is right for
  // every name. A plural label would print "September and October has been".
  const now = new Date(2026, 9, 7);
  const labels = [];
  for (const back of [0, 1, 2, 5, RANGE.MAX_BACK]) {
    labels.push(RANGE.flowerRange('week', back, now).label);
    labels.push(RANGE.flowerRange('month', back, now).label);
  }
  for (const l of labels) {
    const sentence = evenlySpread(l);
    assert.ok(/ has been fairly evenly spread\.$/.test(sentence), `"${l}" does not take a singular verb`);
    assert.ok(/^[A-Z]/.test(sentence), `"${l}" is not sentence cased`);
    assert.ok(!/\bweeks\b|\bmonths\b/.test(l), `"${l}" is plural, so the one clause is wrong for it`);
  }
  return `${labels.length} labels, all singular`;
});

check('and this check can fail', () => {
  assert.ok(/September has been fairly evenly spread\./.test(evenlySpread('September')));
  // The sentence the old lookup produced when a noun was substituted into it,
  // which is the fault the singular rule exists to prevent.
  assert.ok(/Six weeks has been/.test(evenlySpread('six weeks')), 'the fixture is not the known bad case');
  assert.ok(
    !RANGE.flowerRange('month', 0, new Date(2026, 9, 7)).label.includes('weeks'),
    'a real label is plural'
  );
  return 'the plural sentence is reproducible and no real label makes it';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
