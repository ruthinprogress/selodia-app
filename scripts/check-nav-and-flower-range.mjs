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

check('this week is Monday to Monday, half open and local', () => {
  // A Wednesday.
  const now = new Date(2026, 9, 7, 14, 0, 0);
  const r = RANGE.flowerRange('week', 0, now);
  assert.strictEqual(r.from.getDay(), 1, 'the week does not start on Monday');
  assert.strictEqual(r.days, 7, 'a week is not seven days');
  assert.strictEqual(r.to.getTime() - r.from.getTime(), 7 * 86_400_000, 'the window is not a week long');
  assert.strictEqual(r.label, 'this week');
  // SUNDAY BELONGS TO THE WEEK BEFORE IT, which getDay does not do on its own.
  const sunday = new Date(2026, 9, 11, 23, 30, 0);
  assert.strictEqual(RANGE.flowerRange('week', 0, sunday).from.getDate(), 5, 'Sunday fell into the next week');
  return 'Monday 5 October to Monday 12 October';
});

check('a month is the calendar month, not four weeks', () => {
  const now = new Date(2026, 9, 7);
  const r = RANGE.flowerRange('month', 0, now);
  assert.strictEqual(r.from.getDate(), 1, 'a month does not start on the first');
  assert.strictEqual(r.days, 31, 'October is not 31 days long');
  assert.strictEqual(r.label, 'this month');
  // ROUNDING A MONTH TO FOUR WEEKS WOULD SET THE TARGET 10% LIGHT and fill
  // every petal that bit too easily, which is why the span is fractional.
  assert.ok(Math.abs(RANGE.weeksIn(r) - 31 / 7) < 1e-9, 'the span is not the real length in weeks');
  // February, and a leap year, because setMonth is doing the work.
  assert.strictEqual(RANGE.flowerRange('month', 0, new Date(2026, 1, 15)).days, 28, 'February 2026 is not 28 days');
  assert.strictEqual(RANGE.flowerRange('month', 0, new Date(2028, 1, 15)).days, 29, 'February 2028 is not 29 days');
  return '31, 28 and 29 days, each exact';
});

check('paging back crosses the year without naming it wrongly', () => {
  const now = new Date(2026, 0, 15);
  assert.strictEqual(RANGE.flowerRange('month', 1, now).label, 'December 2025', 'last year is not named');
  assert.strictEqual(RANGE.flowerRange('month', 0, now).label, 'this month');
  assert.strictEqual(RANGE.flowerRange('week', 1, now).label, 'last week');
  // Further back than "last" gets a date rather than a count nobody can hold.
  assert.ok(/^week of /.test(RANGE.flowerRange('week', 4, now).label), 'an older week has no date in its name');
  return 'December 2025, last week, week of ...';
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
