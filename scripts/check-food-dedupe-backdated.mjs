// CAN THE DUPLICATE GUARD SEE A MEAL LOGGED FOR A PAST DAY?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-food-dedupe-backdated.mjs
//
// Ruth, 4 October 2026, voice-logging her Saturday: "in the log page itself
// everything came through twice."
//
// Her four meals went in twice, sixteen seconds apart, from two different turns:
// "Hi, I forgot to log the food yesterday. So I had two black coffees and a
// cheesy omelette..." and then "Yeah, that's right. Could you log it, please?".
// The second was a fair instruction and nothing in the app knew it had already
// done it.
//
// THE GUARD EXISTED AND WAS WELL BUILT. lib/food-dedupe.ts compares content
// words as a set, at the write, where the model cannot decline it - written on
// 18 September after one dinner became nine rows and 5,137 kcal. On Ruth's two
// sets it returns 'longer' correctly: the only difference between
// "Dinner - fish and chips and mushy peas" and "Yesterday: Dinner - fish and
// chips and mushy peas" is the word "yesterday".
//
// IT WAS NEVER GIVEN THE ROWS. The candidate query asked for food_logs whose
// happened_at was within ten minutes of NOW:
//
//     .gte('happened_at', new Date(Date.now() - FOOD_DEDUPE_WINDOW_MIN * 60_000)...)
//
// A catch-up is stamped with the day it is being logged FOR, so yesterday's
// breakfast sits about twenty-four hours outside that window and never appears.
// The comparison never ran. Backdated logging - one of the main things people
// use this for - had no duplicate protection at all, for as long as the guard
// has existed.
//
// WHY BOTH HALVES ARE CHECKED HERE. Every pure case below passed on the broken
// code, because the pure function was never the problem. The second half reads
// the query as source, which is the only place the fault was visible.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { findSameMeal, sameMeal, FOOD_DEDUPE_WINDOW_MIN } = await import(
  root + '/app/lib/food-dedupe.ts'
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

console.log('\n  A MEAL LOGGED FOR YESTERDAY IS STILL THE SAME MEAL\n');

// Her two sets, verbatim from food_logs.
const YESTERDAY = '2026-10-03T12:59:08.000Z';
const FIRST = [
  'Breakfast - two black coffees, cheesy omelette',
  'Lunch - a flapjack, two glace cherry chocolates',
  'Pub - an Aperol spritz, a lager shandy, a mini lemon cupcake',
  'Dinner - fish and chips and mushy peas',
];
const SECOND = [
  'Yesterday: breakfast - two black coffees, cheesy omelette',
  'Yesterday: Lunch - a flapjack, two glace cherry chocolates',
  'Yesterday: Pub - an Aperol spritz, a lager shandy, a mini lemon cupcake',
  'Yesterday: Dinner - fish and chips and mushy peas',
];

check('the words alone identify the repeat', () => {
  for (let i = 0; i < FIRST.length; i++) {
    const m = sameMeal(FIRST[i], SECOND[i]);
    assert.ok(m, `no match for ${SECOND[i]}`);
    assert.strictEqual(m.how, 'longer', `${SECOND[i]} matched as ${m.how}`);
  }
  return `${FIRST.length} meals, each recognised as the same one again`;
});

check('a backdated repeat is found when the rows are offered', () => {
  // The rows as they would come back from the query, stamped yesterday.
  const recent = FIRST.map((raw_text, i) => ({
    id: `row-${i}`,
    raw_text,
    happened_at: YESTERDAY,
  }));
  const claimed = new Set();
  const found = SECOND.map((text) => findSameMeal(text, YESTERDAY, recent, claimed));
  for (const [i, f] of found.entries()) {
    assert.ok(f, `no match for ${SECOND[i]}`);
    claimed.add(f.log.id);
  }
  assert.strictEqual(new Set(found.map((f) => f.log.id)).size, 4, 'two meals folded into one row');
  return 'all four matched, one row each';
});

check('a catch-up still cannot merge with a different day', () => {
  // The protection that must survive the fix: widening the candidate list must
  // not let last Monday's dinner absorb this afternoon's.
  const recent = [{ id: 'old', raw_text: FIRST[3], happened_at: '2026-09-28T19:00:00.000Z' }];
  assert.strictEqual(
    findSameMeal(SECOND[3], YESTERDAY, recent),
    null,
    'a meal five days apart was treated as the same one'
  );
  return `${FOOD_DEDUPE_WINDOW_MIN} minutes either side, and no further`;
});

check('two genuinely different meals on the same day stay apart', () => {
  const recent = [{ id: 'b', raw_text: FIRST[0], happened_at: YESTERDAY }];
  assert.strictEqual(
    findSameMeal(FIRST[3], YESTERDAY, recent),
    null,
    'breakfast and dinner were merged'
  );
  return 'breakfast is not dinner';
});

// ---- the half that would actually have caught it -------------------------
check('the candidate query is anchored to the entry, not to the clock', () => {
  const src = readFileSync('app/lib/food-logging.ts', 'utf8');
  // ANCHORED ON THE DEDUPE'S OWN COMMENT, not on the first food_logs query in
  // the file - there are several, and the first version of this check read a
  // different one and failed for a reason that had nothing to do with the bug.
  const at = src.indexOf('IS ANY OF THIS A MEAL ALREADY RECORDED?');
  assert.ok(at > 0, 'the dedupe block has moved - has food-logging been rewritten?');
  const block = src.slice(at, src.indexOf('const recent =', at));

  assert.ok(
    !/\.gte\(\s*'happened_at',\s*new Date\(Date\.now\(\)/.test(block),
    'the candidate query is bounded by Date.now(), so it can only ever see meals ' +
      'being logged as they are eaten. Anything logged for a past day is invisible ' +
      'to the duplicate guard, which is exactly how Ruth got her Saturday twice.'
  );
  assert.ok(
    /Math\.min\(\.\.\.times\)/.test(block) && /Math\.max\(\.\.\.times\)/.test(block),
    'the range does not span the batch, so a message describing several meals at ' +
      'different times only has candidates fetched for some of them'
  );
  assert.ok(
    /\.lte\(\s*'happened_at'/.test(block),
    'the query has no upper bound, so it is not a window around the entry at all'
  );
  return 'bounded by the rows being written';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
