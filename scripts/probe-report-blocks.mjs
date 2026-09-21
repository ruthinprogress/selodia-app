// WHAT THE PHONE SENDS, AND WHAT THE SERVER AGREES TO READ.
//
// readBlocks is the only thing between a POST body and a set of queries, so
// it is tested the way a guard is tested: with the sensible case first, then
// with everything a wrong, stale or hostile client could put in the field.
//
//   npx tsx scripts/probe-report-blocks.mjs

import { groupFood, readBlocks, weekBeginning } from '../app/lib/report.ts';

let passed = 0;
let failed = 0;

function group(name) {
  console.log(`\n  ${name.toUpperCase()}\n`);
}

function check(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        got  ${a}`);
    console.log(`        want ${b}`);
  }
}

group('what the builder sends');

check(
  'a whole source',
  readBlocks([{ source: 'profile' }]),
  [{ source: 'profile' }]
);

check(
  'three symptoms and not the fourth',
  readBlocks([{ source: 'symptoms', ids: ['a', 'b', 'c'] }]),
  [{ source: 'symptoms', ids: ['a', 'b', 'c'] }]
);

check(
  'waist only',
  readBlocks([{ source: 'metrics', names: ['waist'] }]),
  [{ source: 'metrics', names: ['waist'] }]
);

check(
  'food at every entry',
  readBlocks([{ source: 'food', detail: 'entries' }]),
  [{ source: 'food', detail: 'entries' }]
);

check(
  'her allergy report: some symptoms, food, and nothing else',
  readBlocks([
    { source: 'profile' },
    { source: 'symptoms', ids: ['s1', 's2'] },
    { source: 'food', detail: 'entries' },
  ]),
  [
    { source: 'profile' },
    { source: 'symptoms', ids: ['s1', 's2'] },
    { source: 'food', detail: 'entries' },
  ]
);

group('a block that would print an empty heading');

check('symptoms with no ids', readBlocks([{ source: 'symptoms' }]), []);
check('symptoms with an empty list', readBlocks([{ source: 'symptoms', ids: [] }]), []);
check('metrics with no names', readBlocks([{ source: 'metrics' }]), []);
check('activity with no types', readBlocks([{ source: 'activity' }]), []);
check('plans, insights and cards alike', readBlocks([
  { source: 'plans' },
  { source: 'insights' },
  { source: 'cards' },
]), []);

group('what must never reach a query');

check('not an array', readBlocks({ source: 'profile' }), []);
check('null', readBlocks(null), []);
check('an unknown source', readBlocks([{ source: 'medications' }]), []);
check('a source that is not a string', readBlocks([{ source: 7 }]), []);
check('an item that is null', readBlocks([null, { source: 'goals' }]), [{ source: 'goals' }]);

check(
  'ids that are not strings are dropped, the strings kept',
  readBlocks([{ source: 'symptoms', ids: ['a', 3, null, { id: 'b' }, 'c'] }]),
  [{ source: 'symptoms', ids: ['a', 'c'] }]
);

check(
  'ids that are not a list at all',
  readBlocks([{ source: 'symptoms', ids: 'a,b,c' }]),
  []
);

check(
  'an empty string is not an id',
  readBlocks([{ source: 'symptoms', ids: ['', '  x'] }]),
  [{ source: 'symptoms', ids: ['  x'] }]
);

check(
  'a made-up detail is ignored, the block kept',
  readBlocks([{ source: 'food', detail: 'everything' }]),
  [{ source: 'food' }]
);

check(
  'extra fields do not travel',
  readBlocks([{ source: 'goals', limit: 1000, table: 'auth.users' }]),
  [{ source: 'goals' }]
);

group('size and repetition');

// A REAL SELECTION IS NEVER TRUNCATED. The cap is a ceiling on one request's
// work, not a limit on how much of her own record she may send - 500 symptoms
// ticked must be 500 symptoms printed.
const many = Array.from({ length: 500 }, (_, i) => `id-${i}`);
const notCapped = readBlocks([{ source: 'symptoms', ids: many }]);
check('five hundred ids all survive', notCapped[0].ids.length, 500);
check('the first is kept', notCapped[0].ids[0], 'id-0');
check('and so is the last', notCapped[0].ids[499], 'id-499');

const absurd = Array.from({ length: 4000 }, (_, i) => `id-${i}`);
check('the ceiling is still a ceiling', readBlocks([{ source: 'symptoms', ids: absurd }])[0].ids.length, 1000);

check(
  'the same id twice is once',
  readBlocks([{ source: 'symptoms', ids: ['a', 'a', 'b', 'a'] }]),
  [{ source: 'symptoms', ids: ['a', 'b'] }]
);

check(
  'the same source twice is once',
  readBlocks([
    { source: 'symptoms', ids: ['a'] },
    { source: 'symptoms', ids: ['b'] },
  ]),
  [{ source: 'symptoms', ids: ['a'] }]
);

check(
  'fifty metric names at most',
  readBlocks([{ source: 'metrics', names: Array.from({ length: 200 }, (_, i) => `m${i}`) }])[0]
    .names.length,
  50
);

group('the old shape, from a phone that has not updated');

check(
  'sections and cardIds are not blocks',
  readBlocks(['profile', 'goals', 'symptoms']),
  []
);

group('how much food to show');

check('daily is a grain', readBlocks([{ source: 'food', detail: 'daily' }]), [{ source: 'food', detail: 'daily' }]);
check('so is weekly', readBlocks([{ source: 'food', detail: 'weekly' }]), [{ source: 'food', detail: 'weekly' }]);
check('so is monthly', readBlocks([{ source: 'food', detail: 'monthly' }]), [{ source: 'food', detail: 'monthly' }]);
// A phone built before 21 September still says 'totals' and means a day.
check('the old word still arrives', readBlocks([{ source: 'food', detail: 'totals' }]), [{ source: 'food', detail: 'totals' }]);
check('an invented grain is ignored', readBlocks([{ source: 'food', detail: 'hourly' }]), [{ source: 'food' }]);

group('a week begins on a monday');

check('a wednesday', weekBeginning('2026-09-16'), '2026-09-14');
check('the monday itself', weekBeginning('2026-09-14'), '2026-09-14');
// THE ONE THAT CATCHES A BAD IMPLEMENTATION. getUTCDay is 0 on Sunday, so a
// naive subtraction sends a Sunday forward into a week that has not started.
check('a sunday belongs to the week that is ending', weekBeginning('2026-09-20'), '2026-09-14');
check('and the next day starts a new one', weekBeginning('2026-09-21'), '2026-09-21');
check('across a month boundary', weekBeginning('2026-10-01'), '2026-09-28');
check('nonsense comes back unchanged', weekBeginning('not-a-date'), 'not-a-date');

group('grouping food, and saying how many days it rests on');

const meals = [
  { happened_at: '2026-09-14T08:00:00Z', kcal: 400, protein_g: 20 },
  { happened_at: '2026-09-14T19:00:00Z', kcal: 600, protein_g: 30 },
  { happened_at: '2026-09-16T12:00:00Z', kcal: 500, protein_g: 25 },
  { happened_at: '2026-10-02T12:00:00Z', kcal: 700, protein_g: 35 },
];

check('daily keeps a row per day', groupFood(meals, 'daily').map((r) => r.label), [
  '2026-09-14',
  '2026-09-16',
  '2026-10-02',
]);
check('and counts its own entries', groupFood(meals, 'daily')[0], {
  label: '2026-09-14',
  kcal: 1000,
  protein: 50,
  entries: 2,
  days: 1,
});

const weekly = groupFood(meals, 'weekly');
check('weekly gathers the week', weekly.map((r) => r.label), ['2026-09-14', '2026-09-28']);
// DAYS IS THE DENOMINATOR AND IT IS NOT DECORATION. 1500 kcal across a week
// means one thing over seven logged days and another over two.
check('1500 kcal across 2 logged days, from 3 entries', [weekly[0].kcal, weekly[0].days, weekly[0].entries], [1500, 2, 3]);

const monthly = groupFood(meals, 'monthly');
check('monthly gathers the month', monthly.map((r) => r.label), ['2026-09', '2026-10']);
check('September holds three entries over two days', [monthly[0].kcal, monthly[0].days, monthly[0].entries], [1500, 2, 3]);

check('nothing logged groups to nothing', groupFood([], 'weekly'), []);

check(
  'a missing figure counts as zero and never as absent',
  groupFood([{ happened_at: '2026-09-14T08:00:00Z', kcal: null, protein_g: null }], 'daily')[0],
  { label: '2026-09-14', kcal: 0, protein: 0, entries: 1, days: 1 }
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
