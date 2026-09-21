// SEVERAL THINGS ARE SEVERAL ROWS (Bug 18).
//
// Ruth, 21 September 2026: "When a user logs multiple items in one message
// (e.g. 'mug of tea and a cookie'), they are being stored as one combined
// entry ... it was lost at storage time. This is a data architecture issue,
// not just a display issue."
//
// Her two real entries are the first cases here.
//
//   npx tsx scripts/probe-itemisation.mjs

import { entriesNeedingSplit, thingsNamed, underItemised } from '../app/lib/itemisation.ts';

let passed = 0;
let failed = 0;

function group(name) { console.log(`\n  ${name.toUpperCase()}\n`); }

function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    passed += 1; console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  }
}

group('counting what was named');

check('her first entry', thingsNamed('Mug of tea and a cookie'), 2);
check('her second entry', thingsNamed('Herbal tea, English tea with milk, and a biscuit'), 4);
check('one thing', thingsNamed('a banana'), 1);
check('one thing, long sentence', thingsNamed('a really good bowl of porridge'), 1);
check('nothing', thingsNamed(''), 0);
check('nothing at all', thingsNamed(null), 0);
// A WEIGHT IS NOT A THING. "200g" on its own must not count as an item.
check('a weight is not a thing', thingsNamed('200g chicken'), 1);
check('a list with weights', thingsNamed('200g chicken and 100g rice'), 2);

group('the contradiction it exists to catch');

// HER TWO ENTRIES, both stored as one row when they named several things.
check('tea and a cookie, one row', underItemised('Mug of tea and a cookie', [{ name: 'Tea and cookie' }]), true);
check('three teas and a biscuit, one row', underItemised('Herbal tea, English tea with milk, and a biscuit', [{ name: 'Tea and biscuit' }]), true);
check('two things, no rows at all', underItemised('tea and a cookie', []), true);
check('two things, no items field', underItemised('tea and a cookie', undefined), true);

group('what it must leave alone');

// ALREADY SPLIT IS NOT A PROBLEM, however many things there were.
check('two things, two rows', underItemised('tea and a cookie', [{ name: 'Tea' }, { name: 'Cookie' }]), false);
check('three things, three rows', underItemised('a, b and c', [{ name: 'a' }, { name: 'b' }, { name: 'c' }]), false);
// ONE THING IN ONE ROW IS CORRECT, and must never trigger a re-ask.
check('one thing, one row', underItemised('a banana', [{ name: 'Banana' }]), false);
check('a lasagne is one dish', underItemised('a lasagne', [{ name: 'Lasagne' }]), false);
check('nothing named', underItemised('', [{ name: 'x' }]), false);

group('across a whole parse');

check('nothing wrong', entriesNeedingSplit([{ entry_text: 'a banana', items: [{ name: 'Banana' }] }], 'a banana'), 0);
check(
  'one bad entry out of two',
  entriesNeedingSplit(
    [
      { entry_text: 'a banana', items: [{ name: 'Banana' }] },
      { entry_text: 'tea and a cookie', items: [{ name: 'Tea and cookie' }] },
    ],
    'whatever'
  ),
  1
);
// AN ENTRY WITH NO TEXT OF ITS OWN falls back to the whole message, which is
// what a single-entry parse looks like.
check(
  'falls back to the message',
  entriesNeedingSplit([{ items: [{ name: 'Tea and cookie' }] }], 'Mug of tea and a cookie'),
  1
);
check('no entries at all', entriesNeedingSplit(undefined, 'anything'), 0);
check('empty parse', entriesNeedingSplit([], 'anything'), 0);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
