// WHAT THE PHONE SENDS, AND WHAT THE SERVER AGREES TO READ.
//
// readBlocks is the only thing between a POST body and a set of queries, so
// it is tested the way a guard is tested: with the sensible case first, then
// with everything a wrong, stale or hostile client could put in the field.
//
//   npx tsx scripts/probe-report-blocks.mjs

import { readBlocks } from '../app/lib/report.ts';

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

const many = Array.from({ length: 500 }, (_, i) => `id-${i}`);
const capped = readBlocks([{ source: 'symptoms', ids: many }]);
check('two hundred ids at most', capped[0].ids.length, 200);
check('the first is kept', capped[0].ids[0], 'id-0');

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

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
