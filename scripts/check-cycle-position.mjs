// DAY 14 IS NOT A PLACE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-cycle-position.mjs
//
// Ruth's cycles, from the session of 9 October 2026: 29, 24, 35, 26, 31 days in
// five months. Ovulation in a 24-day cycle is around day 10; in a 35-day cycle
// it is around day 21. So "you logged this on day 14 three cycles running"
// compares three different phases and calls them one.
//
// That is the exact error the cycle redesign exists to avoid - the premise of
// the whole app for women over 40 is that an irregular cycle is information,
// not noise to be averaged into a tidy 28 days. A cross-cycle line built on
// naive day numbers would reproduce it while looking clever.
//
// WHAT THIS PROVES, with her real lengths:
//   - early days compare forward, because the bleed starts when the cycle does
//   - late days compare backward, because the luteal phase is pinned to the end
//   - middle days only compare between cycles of a similar length
//   - the CURRENT cycle can never be compared backward, because its next
//     period has not happened

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const {
  buildCycles,
  placeInCycle,
  samePlace,
  describePlace,
  COMPARABLE_LENGTH_TOLERANCE,
} = await import(root + '/app/lib/cycle-position.ts');

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

// Her five cycles, as lengths: 29, 24, 35, 26, then the current one open.
const STARTS = ['2026-05-04', '2026-06-02', '2026-06-26', '2026-07-31', '2026-08-26', '2026-09-26'];
const CYCLES = buildCycles(STARTS);

console.log('\n  DAY 14 IS NOT A PLACE\n');

check('the cycles come out with her real lengths', () => {
  const lengths = CYCLES.map((c) => c.length);
  assert.deepStrictEqual(lengths, [29, 24, 35, 26, 31, null], JSON.stringify(lengths));
  assert.strictEqual(CYCLES[CYCLES.length - 1].next, null, 'the newest cycle should be open');
  return '29, 24, 35, 26, 31, and one still open';
});

check('duplicated and unsorted starts do not produce phantom cycles', () => {
  // cycle_events upserts on (person, date, type), but a date can still arrive
  // twice from two sources and the caller's order is not guaranteed.
  const messy = buildCycles(['2026-06-02', '2026-05-04', '2026-06-02', '2026-06-26']);
  assert.strictEqual(messy.length, 3, `got ${messy.length} cycles from 3 distinct starts`);
  assert.deepStrictEqual(messy.map((c) => c.length), [29, 24, null]);
  return '4 inputs, 3 cycles, correct lengths';
});

check('a date before any period cannot be placed', () => {
  // Inventing a cycle by assuming a length is the guess this must refuse.
  assert.strictEqual(placeInCycle(CYCLES, '2026-04-30'), null);
  return 'null, not a guess';
});

check('an early day is pinned to the start', () => {
  const p = placeInCycle(CYCLES, '2026-06-04'); // 3rd day of the 24-day cycle
  assert.strictEqual(p.dayFromStart, 3);
  assert.strictEqual(p.anchor, 'early');
  assert.strictEqual(p.cycle.length, 24);
  return 'day 3 of the 24-day cycle';
});

check('a late day is pinned to the end, not the start', () => {
  // 4 days before the next period, in the 35-day cycle. Counting forward that
  // is day 32, which means nothing; counting back it is the luteal phase.
  const p = placeInCycle(CYCLES, '2026-07-27');
  assert.strictEqual(p.anchor, 'late');
  assert.strictEqual(p.daysBeforeNext, 4);
  assert.strictEqual(p.dayFromStart, 32);
  return '4 days before the next period, which is day 32 forward';
});

check('THE ONE THAT MATTERS: day 14 of a 24-day cycle is not day 14 of a 35-day cycle', () => {
  const short = placeInCycle(CYCLES, '2026-06-15'); // day 14 of the 24-day cycle
  const long = placeInCycle(CYCLES, '2026-07-09');  // day 14 of the 35-day cycle
  assert.strictEqual(short.dayFromStart, 14);
  assert.strictEqual(long.dayFromStart, 14);
  assert.strictEqual(short.cycle.length, 24);
  assert.strictEqual(long.cycle.length, 35);
  assert.strictEqual(
    samePlace(short, long),
    false,
    'day 14 of a 24-day cycle was treated as the same place as day 14 of a 35-day cycle'
  );
  return 'same day number, 11 days apart in length, refused';
});

check('and this check can fail', () => {
  // Everything above turns on samePlace returning false, which a function that
  // always returns false would also do. So prove it says yes when it should.
  const a = placeInCycle(CYCLES, '2026-07-09'); // day 14, 35-day cycle
  const b = placeInCycle(CYCLES, '2026-09-08'); // day 14, 31-day cycle
  assert.strictEqual(Math.abs(a.cycle.length - b.cycle.length), 4);
  assert.ok(
    samePlace(a, b),
    'two middle days in cycles 4 days apart should compare - nothing would ever match'
  );
  // And the naive version really would have matched the pair above.
  const naive = (x, y) => x.dayFromStart === y.dayFromStart;
  const short = placeInCycle(CYCLES, '2026-06-15');
  const long = placeInCycle(CYCLES, '2026-07-09');
  assert.ok(naive(short, long), 'the naive comparison does not reproduce the bug');
  return 'yes for 35 vs 31; the naive version would have said yes to 24 vs 35';
});

check('early days compare even when the cycles are nothing alike', () => {
  // Day 2 is day 2 whatever happens later: the bleed starts when the cycle does.
  const a = placeInCycle(CYCLES, '2026-06-03'); // day 2 of 24
  const b = placeInCycle(CYCLES, '2026-06-27'); // day 2 of 35
  assert.strictEqual(a.anchor, 'early');
  assert.strictEqual(b.anchor, 'early');
  assert.ok(samePlace(a, b), 'two second days were not treated as the same place');
  return 'day 2 of a 24 and day 2 of a 35 do compare';
});

check('late days compare across very different cycles too', () => {
  // Pinned to the end, so the length in front of them does not matter.
  const a = placeInCycle(CYCLES, '2026-06-22'); // 4 before next, 24-day cycle
  const b = placeInCycle(CYCLES, '2026-07-27'); // 4 before next, 35-day cycle
  assert.strictEqual(a.daysBeforeNext, 4);
  assert.strictEqual(b.daysBeforeNext, 4);
  assert.ok(samePlace(a, b), 'two days four before a period were not the same place');
  return 'four days before, in a 24 and a 35';
});

check('an early day and a late day are never the same place', () => {
  const early = placeInCycle(CYCLES, '2026-06-04');
  const late = placeInCycle(CYCLES, '2026-07-27');
  assert.strictEqual(samePlace(early, late), false);
  return 'different ends of a cycle';
});

check('the current cycle can never be compared backward', () => {
  // Its next period has not happened, so "10 days before my period" is unknown
  // however late it feels. Quietly comparing it anyway is how a tracker says
  // something confident and wrong.
  const today = placeInCycle(CYCLES, '2026-10-20');
  assert.strictEqual(today.cycle.next, null, 'that date should be in the open cycle');
  assert.strictEqual(today.daysBeforeNext, null);
  assert.notStrictEqual(today.anchor, 'late', 'a day in the open cycle was called late');
  const pastLate = placeInCycle(CYCLES, '2026-07-27');
  assert.strictEqual(samePlace(today, pastLate), false);
  return 'no end date, so no backward comparison';
});

check('how it says the position out loud', () => {
  assert.strictEqual(describePlace(placeInCycle(CYCLES, '2026-06-04')), 'around day 3');
  assert.strictEqual(
    describePlace(placeInCycle(CYCLES, '2026-07-27')),
    'about 4 days before your period'
  );
  assert.strictEqual(
    describePlace(placeInCycle(CYCLES, '2026-07-30')),
    'just before your period'
  );
  // Never names a phase. Calling something ovulation is a judgement the reply
  // makes in context, not something a date function asserts.
  for (const d of ['2026-06-04', '2026-07-09', '2026-07-27']) {
    const said = describePlace(placeInCycle(CYCLES, d));
    assert.ok(
      !/ovulat|luteal|follicular|menstrual/i.test(said),
      `names a phase: ${said}`
    );
  }
  return '"around day 3", "about 4 days before your period", and never a phase name';
});

check('the tolerance is a real number somebody chose', () => {
  assert.strictEqual(COMPARABLE_LENGTH_TOLERANCE, 4);
  // Wide enough for ordinary variation, narrow enough that her 24 and her 35
  // never compare.
  assert.ok(COMPARABLE_LENGTH_TOLERANCE < 11, 'her 24 and 35 day cycles would compare');
  assert.ok(COMPARABLE_LENGTH_TOLERANCE >= 2, 'nothing would ever compare');
  return '4 days either way';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
