// Can one dinner, described five times, stay one dinner?
//
// Built from the real rows of 2026-09-18, when Ruth described an oxtail stew in
// a voice call and nine food_logs went in across 53 seconds - her whole day read
// 5,137 kcal. Pure functions, no API, free to run.
//
//   npx tsx scripts/probe-food-dedupe.mjs

import { findSameMeal, normaliseFoodText, sameMeal } from '../app/lib/food-dedupe.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`
  );
};

console.log('\n  THE REAL EVENING, PAIR BY PAIR\n');

const DINNER = [
  '73g boiled new potatoes',
  '73g boiled new potatoes with oxtail stew',
  '73g boiled new potatoes and oxtail stew',
  '73g boiled new potatoes and 250g oxtail stew (homemade)',
  '73g boiled new potatoes with 250g homemade oxtail stew (mainly meat with a few vegetables)',
];

const how = (a, b) => sameMeal(a, b)?.how ?? null;
check('the fragment is carried by the fuller sentence', how(DINNER[0], DINNER[1]), 'longer');
// The failure the first version of this file shipped with: one word of grammar
// made these two dinners.
check('"with" and "and" describe one plate', how(DINNER[1], DINNER[2]), 'same');
check('the same words again', how(DINNER[4], DINNER[4]), 'same');
check('a restatement of part of it', how(DINNER[4], DINNER[0]), 'shorter');
check('a different dinner entirely', how(DINNER[4], 'roast chicken with greens'), null);

console.log('\n  THE WHOLE SEQUENCE, AS IT ARRIVED\n');

// Each utterance lands a few seconds after the last, exactly as it did.
const base = Date.parse('2026-09-18T16:55:04.000Z');
const at = (s) => new Date(base + s * 1000).toISOString();
const arrivals = [
  [DINNER[0], 0],
  [DINNER[1], 5],
  [DINNER[2], 6],
  [DINNER[3], 9],
  [DINNER[4], 10],
  [DINNER[4], 36],
  [DINNER[4], 52],
  [DINNER[4], 53],
];

const logs = [];
let rowsCreated = 0;
for (const [text, secs] of arrivals) {
  const match = findSameMeal(text, at(secs), logs);
  if (!match) {
    logs.push({ id: `row-${++rowsCreated}`, raw_text: text, happened_at: at(secs) });
  } else if (match.how === 'longer') {
    match.log.raw_text = text;
  }
}
check('eight utterances, how many rows', rowsCreated, 1);
check('and it holds the fullest description', logs[0].raw_text, DINNER[4]);

console.log('\n  WHAT MUST STILL BE TWO ENTRIES\n');

const lunch = [{ id: 'a', raw_text: 'tin of sardines in brine with lettuce', happened_at: at(0) }];
check(
  'a different meal in the same minute',
  findSameMeal('two slices of sourdough toast with butter', at(30), lunch),
  null
);
check(
  'the same words tomorrow',
  findSameMeal('tin of sardines in brine with lettuce', new Date(base + 86_400_000).toISOString(), lunch),
  null
);
check(
  'the same words eleven minutes later',
  findSameMeal('tin of sardines in brine with lettuce', at(11 * 60), lunch),
  null
);

// Short entries are ordinary and repeat honestly: two cups of tea ten minutes
// apart is two cups of tea, so the rule keeps its hands off them. Two in the
// same breath is a double-send.
const drink = [{ id: 'b', raw_text: 'a cup of tea', happened_at: at(0) }];
check('a second cup of tea, later', findSameMeal('a cup of tea', at(5 * 60), drink), null);
check('the same cup twice in a second', findSameMeal('a cup of tea', at(1), drink)?.how, 'same');

console.log('\n  A MESSAGE WITH TWO MEALS IN IT\n');

// A catch-up message parses into several rows at once. Both must not fold into
// the same earlier log just because one of them matches it.
const earlier = [
  { id: 'x', raw_text: 'porridge with blueberries', happened_at: at(0) },
  { id: 'y', raw_text: 'porridge with blueberries and honey', happened_at: at(1) },
];
const claimed = new Set();
const first = findSameMeal('porridge with blueberries and honey', at(30), earlier, claimed);
claimed.add(first.log.id);
const second = findSameMeal('porridge with blueberries', at(31), earlier, claimed);
check('the first claims the newest match', first.log.id, 'y');
check('the second cannot claim it again', second.log.id, 'x');

console.log('\n  NORMALISING\n');
check('punctuation and case', normaliseFoodText('250g Oxtail Stew (homemade)!'), '250g oxtail stew homemade');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
