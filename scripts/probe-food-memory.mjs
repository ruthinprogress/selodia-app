// Does a food somebody has logged before get found again, and only that food?
//
// Pure functions, no API, free to run. Generic foods only - no real person's
// log is reproduced here.
//
//   npx tsx scripts/probe-food-memory.mjs

import { FOOD_MEMORY_MAX, pickRemembered, rememberedFoodsBlock } from '../app/lib/food-memory.ts';

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

const row = (name, kcal, created_at, quantity = '1 portion') => ({
  name, quantity, kcal, protein_g: 1, carbs_g: 1, fat_g: 1, created_at,
});

const ROWS = [
  row('Peanut butter', 60, '2026-09-10T08:00:00Z', '1 spoon'),
  row('Peanut butter', 95, '2026-09-12T08:00:00Z', '1 spoon (16g)'),
  row('Butter', 70, '2026-09-11T08:00:00Z', '10g'),
  row('Banana', 105, '2026-09-11T09:00:00Z', '1 medium'),
  row('Oat milk', 45, '2026-09-11T09:00:00Z', '100ml'),
  row('Dinner', 700, '2026-09-11T19:00:00Z'),
  row('Hummus', 80, '2026-09-11T12:00:00Z', '30g'),
  row('Mystery', null, '2026-09-11T12:00:00Z'),
];
const names = (text) => pickRemembered(ROWS, text).map((r) => `${r.name}:${r.kcal}`);

console.log('\n  FINDING WHAT WAS LOGGED BEFORE\n');
check('the most recent value is the one kept', names('toast with peanut butter'), ['Peanut butter:95']);
check('a longer name claims its words first', names('peanut butter on toast'), ['Peanut butter:95']);
check('a separate mention is still found', names('peanut butter and butter on toast'), ['Peanut butter:95', 'Butter:70']);
check('plurals match', names('two bananas'), ['Banana:105']);
check('whole words only: buttermilk is not butter', names('a glass of buttermilk'), []);
check('hummus keeps its s', names('hummus and carrots'), ['Hummus:80']);
check('case and punctuation do not matter', names('OAT-MILK latte'), ['Oat milk:45']);

console.log('\n  WHAT IS NEVER OFFERED\n');
check('a meal name is not a food', names('leftovers from dinner'), []);
check('a food with no stored value is skipped', names('mystery stew'), []);
check('nothing in common, nothing offered', names('grilled salmon and rice'), []);
check('empty text', names(''), []);

console.log('\n  THE PROMPT BLOCK\n');
check('nothing picked, no block', rememberedFoodsBlock([]), '');
const block = rememberedFoodsBlock(pickRemembered(ROWS, 'banana with peanut butter'));
check('names the amount stored', block.includes('"name":"Peanut butter","quantity":"1 spoon (16g)","kcal":95'), true);
check('numbers carry no units (the model copies them)', /\d\s*g[",]/.test(block.replace(/\(16g\)/, '')), false);
check('forbids adding foods not mentioned', block.includes('never add a food from this list'), true);
const many = Array.from({ length: 30 }, (_, i) => row(`food${i}`, 10, '2026-09-11T08:00:00Z'));
check('capped', pickRemembered(many, many.map((r) => r.name).join(' ')).length, FOOD_MEMORY_MAX);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
