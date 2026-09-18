// Does the government's table answer what people actually write?
//
// The scoring half of tier 2, checked without a database: given a description
// and a CoFID food name, should they be treated as the same food? The rows
// quoted here are real names from CoFID 2021.
//
//   npx tsx scripts/probe-cofid-match.mjs

import { scoreComposition } from '../app/lib/food-lookup/composition.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${got}, wanted ${want})`}`);
};
const above = (q, n, t) => scoreComposition(q, n) >= t;

console.log('\n  CoFID INVERTS ITS NAMES, AND THAT MUST NOT COST A MATCH\n');
check('cheddar -> "Cheese, Cheddar, English"', above('cheddar', 'Cheese, Cheddar, English', 0.6), true);
// "Oats, porridge, RAW" is refused, and that is the rule working rather than
// failing: raw weight is not eaten weight, and this is the largest error class
// in the whole dataset. The live table answers this query with "Porridge oats,
// unfortified" instead, which is the food somebody actually weighs.
check(
  'porridge oats does not match a row marked raw',
  above('porridge oats', 'Oats, porridge, raw', 0.6),
  false
);
check(
  'porridge oats -> "Porridge oats, unfortified"',
  above('porridge oats', 'Porridge oats, unfortified', 0.6),
  true
);
check(
  'boiled new potatoes -> "Potatoes, new, boiled in unsalted water"',
  above('boiled new potatoes', 'Potatoes, new, boiled in unsalted water', 0.6),
  true
);

console.log('\n  HOW IT WAS COOKED IS PART OF THE FOOD\n');
// Boiled and roast potatoes are about 80 kcal apart per 100g.
check(
  'boiled does not match roast',
  scoreComposition('boiled new potatoes', 'Potatoes, new, roasted in oil'),
  0
);
check(
  'raw does not match fried',
  scoreComposition('raw mushrooms', 'Mushrooms, common, fried in butter'),
  0
);
// Somebody who writes "mushrooms" has almost certainly cooked them, so a row
// that says raw is refused rather than assumed. Refusing costs one model call;
// assuming costs a wrong number that stays in the record.
check(
  'an unasked-for "raw" is refused',
  above('mushrooms', 'Mushrooms, common, raw', 0.6),
  false
);
check(
  'the head noun must appear: a pancake is not a split',
  scoreComposition('banana pancake', 'Banana split, homemade'),
  0
);

console.log('\n  A DIFFERENT FOOD IS A DIFFERENT FOOD\n');
check('cheddar is not cream cheese', above('cheddar', 'Cheese, cream cheese, full fat', 0.6), false);
check('oats are not oatcakes', above('porridge oats', 'Oatcakes, retail', 0.6), false);
check('nothing in common', scoreComposition('chocolate cake', 'Cod, raw') < 0.2, true);

console.log('\n  MORE SPECIFIC IS NOT BETTER\n');
// If she wrote the words, the row that contains all of them wins; a row that
// adds things she never said should not.
check(
  'the plain row beats the elaborated one',
  scoreComposition('cheddar', 'Cheese, Cheddar, English') >
    scoreComposition('cheddar', 'Cheese, Cheddar, English, reduced fat, with chives'),
  true
);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
