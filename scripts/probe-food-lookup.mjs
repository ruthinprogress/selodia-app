// When may the app answer a food log without asking the model?
//
// Tier 1 and tier 2 of the hybrid lookup (Part Eleven). These checks are all
// about the SAME question: is this the same food? A wrong yes shows somebody
// calories they never ate, which is worse than the API call this system exists
// to save. Pure functions, no network, free to run.
//
//   npx tsx scripts/probe-food-lookup.mjs

import {
  foodWithoutQuantity,
  isSingleWeighedFood,
  normaliseFoodName,
  readQuantity,
} from '../app/lib/food-lookup/normalise.ts';
import { readNutriments, scaleToQuantity, scoreMatch } from '../app/lib/food-lookup/open-food-facts.ts';

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

console.log('\n  THE SAME WORDS, WRITTEN DIFFERENTLY\n');
check('case and punctuation', normaliseFoodName('73g Boiled New Potatoes!'), '73g boiled new potatoes');
check('filler words go', normaliseFoodName('a bit of cheddar'), 'cheddar');
check(
  'two ways of saying one thing agree',
  normaliseFoodName('A black coffee') === normaliseFoodName('black coffee'),
  true
);

console.log('\n  THE QUANTITY IS NOT NOISE\n');
// The spec says to strip quantities. It is wrong, and this is why.
check(
  '73g and 200g of the same food are different keys',
  normaliseFoodName('73g potatoes') === normaliseFoodName('200g potatoes'),
  false
);
check('a weight is read', readQuantity('73g boiled new potatoes'), { grams: 73 });
check('a decimal weight', readQuantity('2.5g salt'), { grams: 2.5 });
check('millilitres are read as millilitres', readQuantity('200ml whole milk'), { millilitres: 200 });
check('no weight at all', readQuantity('a handful of almonds'), null);
check('a number that is not a weight', readQuantity('2 eggs'), null);
check('an implausible weight', readQuantity('9000g rice'), null);

console.log('\n  WHOSE QUESTION IS THIS?\n');
check('one weighed food', isSingleWeighedFood('73g boiled new potatoes'), true);
check('a handful is a judgement, not a weight', isSingleWeighedFood('a handful of almonds'), false);
check(
  'a meal is the model’s question',
  isSingleWeighedFood('Tin of sardines in brine, 60g lettuce, 50g grapes'),
  false
);
check('a description with no food left', foodWithoutQuantity('73g'), null);
check('the food without its weight', foodWithoutQuantity('73g boiled new potatoes'), 'boiled new potatoes');

console.log('\n  IS IT THE SAME FOOD?\n');
const near = (v, want, tol = 0.01) => Math.abs(v - want) < tol;
check('an exact name', near(scoreMatch('cheddar cheese', 'Cheddar Cheese'), 1), true);
check(
  'a more specific product scores lower than an exact one',
  scoreMatch('potatoes', 'Potato Waffles') < scoreMatch('potato waffles', 'Potato Waffles'),
  true
);
check('an unrelated product', scoreMatch('boiled new potatoes', 'Chocolate Digestives') < 0.2, true);

console.log('\n  NUTRIMENTS ARE ALL FOUR OR NOTHING\n');
check(
  'a complete row',
  readNutriments({
    'energy-kcal_100g': 77,
    proteins_100g: 2,
    carbohydrates_100g: 17,
    fat_100g: 0.1,
    sodium_100g: 0.005,
  }),
  { kcal: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, sodium_mg: 5 }
);
// Calories with no protein would log zero protein, and zero is a claim.
check(
  'protein missing',
  readNutriments({ 'energy-kcal_100g': 77, carbohydrates_100g: 17, fat_100g: 0.1 }),
  null
);
check('nothing at all', readNutriments(undefined), null);
check(
  'an impossible energy figure',
  readNutriments({ 'energy-kcal_100g': 5000, proteins_100g: 2, carbohydrates_100g: 17, fat_100g: 0.1 }),
  null
);

console.log('\n  ARITHMETIC, NOT JUDGEMENT\n');
check(
  '73g of something 77 kcal per 100g',
  scaleToQuantity({ kcal: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, sodium_mg: 5 }, 73),
  { kcal: 56, protein_g: 1.5, carbs_g: 12.4, fat_g: 0.1, sodium_mg: 4 }
);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
