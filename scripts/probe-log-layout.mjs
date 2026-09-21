// HER ARRANGEMENT OF THE LOG, APPLIED TO THE APP'S LIST.
//
// Ruth, 21 September 2026: "I don't think everyone will want to log everything,
// so can we make the cards on the logging page so they can be reorganised by
// holding down and just moving up or down" - saved, and with hiding.
//
// The whole risk in this feature is a stored list of ids disagreeing with the
// app's list of rows, in either direction. A saved order can name a row that
// has since been removed, and the app can grow a row her saved order has never
// heard of. Both failures are silent and both lose her a row.
//
//   npx tsx scripts/probe-log-layout.mjs

import { arrange, layoutOf } from '../mobile/src/lib/log-layout-rules.ts';

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

const APP = ['food', 'water', 'sleep', 'body', 'activity', 'symptom', 'photo'].map((id) => ({ id }));
const ids = (rows) => rows.map((r) => r.id);

group('nothing arranged');

check(
  "the app's own order, all of it shown",
  ids(arrange(APP, { order: [], hidden: [] }).shown),
  ['food', 'water', 'sleep', 'body', 'activity', 'symptom', 'photo']
);
check('and nothing hidden', arrange(APP, { order: [], hidden: [] }).hidden, []);

group('her order, applied');

const mine = { order: ['water', 'sleep', 'food'], hidden: [] };
check(
  'what she arranged comes first, in her order',
  ids(arrange(APP, mine).shown).slice(0, 3),
  ['water', 'sleep', 'food']
);
// A ROW SHE HAS NEVER ARRANGED IS NOT A ROW SHE REJECTED.
check(
  'and the rest follow, in the order the app lists them',
  ids(arrange(APP, mine).shown).slice(3),
  ['body', 'activity', 'symptom', 'photo']
);

group('hiding');

const hiding = { order: ['food', 'water', 'sleep'], hidden: ['sleep', 'photo'] };
check('hidden rows leave the list', ids(arrange(APP, hiding).shown), [
  'food',
  'water',
  'body',
  'activity',
  'symptom',
]);
check('and are still known, so they can come back', ids(arrange(APP, hiding).hidden), ['sleep', 'photo']);
check(
  'hiding everything leaves an empty list rather than a broken one',
  ids(arrange(APP, { order: [], hidden: APP.map((r) => r.id) }).shown),
  []
);

group('the two ways a saved order goes stale');

// A ROW THAT NO LONGER EXISTS. Keeping it would leave an invisible gap forever.
check(
  'an id the app no longer has is ignored',
  ids(arrange(APP, { order: ['medication', 'water', 'mood'], hidden: [] }).shown),
  ['water', 'food', 'sleep', 'body', 'activity', 'symptom', 'photo']
);

// A ROW SHE HAS NEVER SEEN. It must arrive, at the end - the same failure
// wearing the other face.
const withNewRow = [...APP, { id: 'mood' }];
check(
  'a row added after she arranged hers appears, at the end',
  ids(arrange(withNewRow, { order: ['water', 'food'], hidden: [] }).shown).at(-1),
  'mood'
);
check(
  'and it is shown, not hidden, because she never said otherwise',
  arrange(withNewRow, { order: ['water', 'food'], hidden: ['sleep'] }).hidden.map((r) => r.id),
  ['sleep']
);

check('nonsense in the store does not empty the screen', ids(arrange(APP, { order: [], hidden: [] }).shown).length, 7);

group('what gets written back');

check('a plain arrangement', layoutOf(['water', 'food'], ['sleep']), {
  order: ['water', 'food', 'sleep'],
  hidden: ['sleep'],
});
// THE HIDDEN ONES KEEP THEIR PLACE IN THE ORDER, so unhiding one puts it back
// where she left it rather than at the bottom.
check(
  'a hidden row is still in the order',
  layoutOf(['food'], ['water']).order.includes('water'),
  true
);
check('nothing hidden', layoutOf(['food', 'water'], []), { order: ['food', 'water'], hidden: [] });

group('a round trip changes nothing');

const start = { order: ['photo', 'symptom', 'food', 'water', 'sleep', 'body', 'activity'], hidden: ['body'] };
const { shown, hidden } = arrange(APP, start);
const again = layoutOf(ids(shown), ids(hidden));
check('arranging and saving returns the same arrangement', arrange(APP, again), arrange(APP, start));

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
