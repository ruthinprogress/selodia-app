// A WEIGHT SHE STATED IS A WEIGHT OF THE DISH.
//
// Her report, 21 September 2026, with the screenshot: "Error is logging chat. I
// said cheese omelette which logged fine, then I had a bit extra and it logged
// it wrong."
//
// From her own rows: "100g cheesy omelette and half a corn on the cob" gave 175
// kcal for the omelette. Two and a half hours later "50g cheese omelette" gave
// 385, itemised as two large eggs plus fifty grams of cheese - an omelette made
// WITH 50g of cheese rather than fifty grams OF omelette. Fifty grams of that
// morning's omelette is about 88.
//
// The first case in this file is her exact entry.
//
//   npx tsx scripts/probe-stated-weight.mjs

import {
  checkStatedWeight,
  gramsIn,
  itemsWeight,
  scaleMacros,
  statedDishWeight,
} from '../app/lib/stated-weight.ts';

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

function truthy(name, value) {
  check(name, Boolean(value), true);
}

group('reading a weight out of words');

check('grams', gramsIn('50g'), 50);
check('with a space', gramsIn('200 g'), 200);
check('spelled out', gramsIn('200 grams'), 200);
check('kilograms', gramsIn('1.2kg'), 1200);
check('ounces', gramsIn('4oz'), 113.4);
check('no weight at all', gramsIn('2 large'), null);
check('nothing', gramsIn(null), null);
// "1 slice" is not one gram.
check('a count is not a weight', gramsIn('1 slice'), null);

group('which weights belong to the whole dish');

check('her entry', statedDishWeight('50g cheese omelette'), 50);
check('with "of"', statedDishWeight('200g of chicken'), 200);
check('hedged', statedDishWeight('about 150g salmon'), 150);

// HER MORNING ENTRY, WHICH MUST BE LEFT ALONE. Two things were described and
// only one was weighed; rescaling the pair to 100g would be the same wrongness
// in the other direction.
check('two things, one weighed', statedDishWeight('100g cheesy omelette and half a corn on the cob'), null);
check('an ingredient, not a dish', statedDishWeight('omelette with 50g cheese'), null);
check('a weight in the middle belongs to what it sits beside', statedDishWeight('toast and 50g cheese'), null);
check('a list', statedDishWeight('50g cheese, crackers'), null);
check('no weight, no claim', statedDishWeight('cheese omelette'), null);
check('a weight and nothing else', statedDishWeight('50g'), null);
check('nothing', statedDishWeight(null), null);

group('what the model said it weighed');

check('all of them weighed', itemsWeight([{ quantity: '50g' }, { quantity: '100g' }]), { grams: 150, stated: 2, of: 2 });
check('some of them', itemsWeight([{ quantity: '50g' }, { quantity: '2 large' }]), { grams: 50, stated: 1, of: 2 });
check('a weight in the name instead', itemsWeight([{ name: 'Cheese 50g' }]), { grams: 50, stated: 1, of: 1 });
check('none', itemsWeight([]), { grams: 0, stated: 0, of: 0 });

group('her exact entry, which is the whole point');

// 385 kcal, itemised as two large eggs and fifty grams of cheese, against a
// stated fifty grams of omelette.
const hers = {
  kcal: 385,
  protein_g: 26,
  items: [
    { name: 'Eggs', quantity: '2 large 100g', kcal: 155, protein_g: 13 },
    { name: 'Cheese', quantity: '50g', kcal: 230, protein_g: 13 },
  ],
};
const verdict = checkStatedWeight('50g cheese omelette', hers);
truthy('a hundred and fifty grams of parts in a fifty gram dish is caught', verdict.rescaled);
check('and scaled by the weight she actually gave', Math.round(verdict.factor * 100) / 100, 0.33);

const fixed = scaleMacros(hers, verdict.factor);
check('385 becomes 128', fixed.kcal, 128);
check('26g of protein becomes 9', fixed.protein_g, 9);
check('and the items come down with it', fixed.items.map((i) => i.kcal), [52, 77]);
truthy('which is far nearer the 88 kcal her morning omelette implies', fixed.kcal < 150);

group('what it must never touch');

// A PLAUSIBLE PORTION IS NOT A CONTRADICTION. The margin is generous on purpose:
// this catches a weight attached to the wrong noun, which is out by a factor,
// and never second-guesses an estimate of what two eggs weigh.
check(
  'items that roughly match the stated weight',
  checkStatedWeight('200g chicken', { kcal: 330, items: [{ quantity: '210g' }] }).rescaled,
  false
);
check(
  'a little over is still fine',
  checkStatedWeight('100g pasta', { kcal: 350, items: [{ quantity: '130g' }] }).rescaled,
  false
);
check(
  'her morning entry is untouched',
  checkStatedWeight('100g cheesy omelette and half a corn on the cob', {
    kcal: 235,
    items: [{ quantity: '100g' }, { quantity: 'half' }],
  }).rescaled,
  false
);
check(
  'no stated weight, nothing to check',
  checkStatedWeight('cheese omelette', { kcal: 385, items: [{ quantity: '50g' }] }).rescaled,
  false
);
// ONE WEIGHED ITEM OUT OF THREE IS NOT A SUM, and treating it as one would
// scale a meal down on the strength of a third of its evidence.
check(
  'a partial sum is not a sum',
  checkStatedWeight('50g cheese omelette', {
    kcal: 385,
    items: [{ quantity: '50g' }, { quantity: '2 large' }],
  }).rescaled,
  false
);
check(
  'no items, nothing to weigh',
  checkStatedWeight('50g cheese omelette', { kcal: 385, items: [] }).rescaled,
  false
);

group('scaling leaves alone what it cannot scale');

const scaled = scaleMacros({ kcal: 100, meal_label: 'Lunch', confidence: 'clear', items: [{ name: 'Cheese' }] }, 0.5);
check('the label survives', scaled.meal_label, 'Lunch');
check('so does the confidence', scaled.confidence, 'clear');
check('a missing macro stays missing', scaled.items[0].kcal, undefined);
check('the name is untouched', scaled.items[0].name, 'Cheese');

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
