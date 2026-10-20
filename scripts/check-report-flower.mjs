// A FLOWER PER WEEK, AND NEVER ONE ACROSS THE LOT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-report-flower.mjs
//
// Ruth, 20 October 2026, when she agreed to rolling windows on the Now tab and
// then saw what it would cost a report: "the data still needs to exists as
// dates... Perhaps the Report builder could retain the weekly/monthly picker...
// going hard 2 weeks and nothing the rest of the time may shoe as adequate when
// it's actually not."
//
// THAT SENTENCE IS THE WHOLE FEATURE AND ALSO THE WHOLE RISK. One flower over a
// six-month report is an average, and an average is exactly what turns a
// fortnight of effort and four months of nothing into a middling, unremarkable
// shape. The fix is arithmetic, not wording: each period is divided by its own
// target, so a quiet month cannot borrow from a busy one.
//
// It would also be very easy to undo by accident. Summing every row and
// dividing by the whole span is the obvious way to write this function, reads
// perfectly well, and produces the misleading document she described. So the
// test below is a report whose two halves are opposites, and it fails if the
// flowers come out looking alike.
//
// AND THIS IS A CLINICAL DOCUMENT. A reader who takes a bare flower to mean a
// quiet week, when it means sessions nothing could weigh, has been misled by
// us. The caption has to say which, and an empty set of drawings must not be
// printed at all.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { groupActivity, weeksIn } = await import(here('app/lib/report.ts'));
const { DIMENSIONS, WEEKLY_TARGET } = await import(here('app/lib/health-flower-dimensions.ts'));
const { carve, REGIONS } = await import(here('scripts/generate-report-flower.mjs'));

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

/** Source with its comments gone, so a check cannot match its own prose. */
const codeOnly = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const render = fs.readFileSync('app/lib/report-render.ts', 'utf8');
const renderCode = codeOnly(render);
const generated = fs.readFileSync('app/lib/health-flower-dimensions.ts', 'utf8');

/** A session with full coverage of one dimension, on a given day. */
const session = (day, d, amount = 100) => ({
  at: `${day}T10:00:00Z`,
  what: 'something',
  minutes: 60,
  ...Object.fromEntries(DIMENSIONS.map((x) => [`cover_${x}`, x === d ? amount : 0])),
});

console.log('\n  WHAT EACH WEEK COVERED\n');

check('THE SERVER DRAWS THE PHONE’S FLOWER, NOT ITS OWN', () => {
  // The same rule as the weighting table one file over: a second copy of these
  // numbers is a second flower, and the report is where that would matter most.
  assert.ok(/GENERATED FILE\. DO NOT EDIT\./.test(generated), 'the server copy is hand-maintained');
  // CUT WHERE THE GENERATOR CUTS, by importing its own boundaries rather than
  // repeating them - two copies of the carve would drift exactly the way the
  // two copies of the flower would.
  for (const [name, r] of Object.entries(REGIONS)) {
    const live = carve(fs.readFileSync(r.file, 'utf8'), r.from, r.to, r.file);
    assert.ok(
      generated.includes(live),
      `the ${name} have drifted from ${r.file} - run scripts/generate-report-flower.mjs`
    );
  }
  return `${Object.keys(REGIONS).length} carves identical`;
});

check('A HARD FORTNIGHT DOES NOT MAKE FOUR EMPTY WEEKS LOOK ADEQUATE', () => {
  // HER SENTENCE, AS ARITHMETIC. Two weeks of real strength work, then four
  // weeks of nothing at all.
  const rows = [
    session('2026-09-07', 'strength'),
    session('2026-09-09', 'strength'),
    session('2026-09-14', 'strength'),
    session('2026-09-16', 'strength'),
    // Six weeks apart, so the four between are empty.
    session('2026-10-12', 'strength'),
  ];
  const weeks = groupActivity(rows, 'weekly');
  assert.strictEqual(weeks.length, 6, `expected six weeks including the gaps, got ${weeks.length}`);

  // Two sessions at 100 against a target of 200 is a full petal.
  assert.strictEqual(weeks[0].coverage.strength, 100, 'the first busy week is not full');
  assert.strictEqual(weeks[1].coverage.strength, 100, 'the second busy week is not full');
  // AND THE EMPTY ONES ARE EMPTY. This is the assertion the whole feature is
  // for: averaged, these six weeks come to 42% and every flower would show it.
  for (const i of [2, 3, 4]) {
    assert.strictEqual(
      weeks[i].coverage.strength,
      0,
      `week ${i + 1} borrowed coverage from a different week`
    );
    assert.strictEqual(weeks[i].sessions, 0, 'an empty week is carrying sessions');
  }
  // The last week has one session, so it is half, not full and not empty.
  assert.strictEqual(weeks[5].coverage.strength, 50, 'one session of two did not give half a petal');
  return 'full, full, nothing, nothing, nothing, half';
});

check('AND A MONTH IS MEASURED AGAINST ITS OWN LENGTH', () => {
  // A flat four weeks would hold February and August to the same bar and make
  // the shorter month look like the better one for no reason but the calendar.
  assert.strictEqual(weeksIn('2026-02', 'monthly'), 28 / 7, 'February is not four weeks long');
  assert.strictEqual(weeksIn('2026-08', 'monthly'), 31 / 7, 'August is not 31 days long');
  assert.strictEqual(weeksIn('2026-01', 'weekly'), 1, 'a week is not one week');
  // Eight full strength sessions in a 31-day month: 800 against 31/7 weeks of
  // target, which is about 90% - high, and not pegged at 100 the way a flat
  // four-week target would peg it.
  const rows = Array.from({ length: 8 }, (_, i) =>
    session(`2026-08-${String(i * 3 + 1).padStart(2, '0')}`, 'strength')
  );
  const [month] = groupActivity(rows, 'monthly');
  const expected = Math.round((800 / (WEEKLY_TARGET * (31 / 7))) * 100);
  assert.strictEqual(month.coverage.strength, expected, 'the month used a target of its own');
  assert.ok(month.coverage.strength < 100, 'a 31-day month filled on a 28-day bar');
  return 'February is four weeks, August is 31 days';
});

check('AN UNCLASSIFIED SESSION IS COUNTED, NEVER GUESSED AT', () => {
  // NULL IS NOT ZERO, which health-flower.ts states in capitals: a row nothing
  // could weigh contributes nothing, and that is different from a row weighed
  // at nothing. In a report the difference is the one a reader cannot see, so
  // the period carries the count and the caption says it.
  const rows = [
    { at: '2026-09-07T10:00:00Z', what: 'Rocket Yoga', minutes: 60 },
    session('2026-09-08', 'strength'),
  ];
  const [week] = groupActivity(rows, 'weekly');
  assert.strictEqual(week.sessions, 2, 'the unweighable session vanished from the count');
  assert.strictEqual(week.classified, 1, 'the count of weighed sessions is wrong');
  assert.strictEqual(week.coverage.strength, 50, 'the unclassified row changed the petal');
  for (const d of DIMENSIONS) {
    if (d !== 'strength') assert.strictEqual(week.coverage[d], 0, `${d} was invented`);
  }
  return 'two sessions, one weighed, one petal';
});

check('THE DOCUMENT NEVER CLAIMS AN AVERAGE', () => {
  // A reader who assumes these are averaged reads the row backwards, and this
  // is a document somebody hands to a clinician.
  assert.ok(/nothing here is averaged/i.test(render), 'the caption no longer rules out an average');
  assert.ok(
    /cannot fill in for a quiet/i.test(render),
    'the caption no longer says a strong period cannot cover a quiet one'
  );
  // AND IT SAYS WHAT A BARE FLOWER MEANS, the same distinction the bar chart
  // caption already makes: not recorded is not the same as not done.
  assert.ok(
    /A bare flower means nothing was recorded, which is not the same as nothing being done/.test(render),
    'the caption no longer explains an empty flower'
  );
  return 'no average, and an empty one explained';
});

check('AND NOTHING IS DRAWN WHEN NOTHING WAS WEIGHED', () => {
  // Six empty flowers under a bar chart full of movement would be a drawing of
  // our own gap, printed as a fact about her.
  const at = renderCode.indexOf('function flowers(');
  assert.ok(at > -1, 'the flower row moved - this check is testing nothing');
  const fn = renderCode.slice(at, at + 1200);
  assert.ok(
    /classified === 0\) return \[\]/.test(fn),
    'a report with no classified sessions still prints a row of empty flowers'
  );
  // THE PETALS ARE NOT LABELLED, and the key is drawn instead. At 22mm across
  // six labels per flower would print below this document's own type floor.
  assert.ok(/flowerKey\(\)/.test(fn), 'the colours are no longer named anywhere');
  return 'drawn only when there is something to draw';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
