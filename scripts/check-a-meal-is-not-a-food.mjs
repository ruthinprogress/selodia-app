// "FOR LUNCH" IS NOT SOMETHING YOU ATE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-meal-is-not-a-food.mjs
//
// Ruth, 21 October 2026: "Duplications in food logging still occurring." Her
// lunch was in twice:
//
//   "wholemeal bread sandwich with salami, cheese and rocket for lunch"
//   "2 black Americano coffees; wholemeal bread sandwich with salami, cheese
//    and rocket"
//
// ONE WORD STOOD BETWEEN THEM. The guard matches on content words and folds a
// shorter account into a longer one, which is exactly the shape of these two -
// except that "lunch" appears in the first and not the second, so the first was
// not a subset of the second, so they were two meals.
//
// IT WAS NEVER ONLY HER SENTENCE. "Porridge for breakfast" and "porridge" were
// two breakfasts, for everybody, every morning. That one took a second fix:
// short entries were compared as normalised TEXT rather than as content words,
// so every word the rest of the file drops was still counted for them - and
// short entries are where a meal name appears most.
//
// THE THIRD TIME THIS CLASS OF BUG HAS BEEN FOUND, which is the thing worth
// writing down. 18 September: grammar words made one dinner into nine rows.
// 12 October: a day label made one dessert into two. Today: a meal name. Each
// time the same shape - a word that describes nothing anybody ate, sitting in
// the comparison and splitting one plate in half.
//
// AND THE COST IS STATED, as the file states it for everything else: a word
// dropped here can never again distinguish two entries. That is why "tea" is
// NOT on the list. In British usage it is a meal and it is also a drink, and
// dropping it would let a cup of tea and a biscuit collapse into one another.

import assert from 'node:assert';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { sameMeal, contentWords, MEAL_WORDS, SHORT_REPEAT_WINDOW_MIN, findSameMeal } = await import(
  here('app/lib/food-dedupe.ts')
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

console.log('\n  A MEAL NAME IS NOT A FOOD\n');

check('HER LUNCH IS ONE LUNCH', () => {
  const sandwich = 'wholemeal bread sandwich with salami, cheese and rocket for lunch';
  const withCoffees = '2 black Americano coffees; wholemeal bread sandwich with salami, cheese and rocket';
  const m = sameMeal(sandwich, withCoffees);
  assert.ok(m, 'the two accounts of her lunch are still two meals');
  // 'longer', so the row is rewritten to the fuller account - the one with the
  // coffees in it, which is what the chat offered to do by hand.
  assert.strictEqual(m.how, 'longer', `matched as ${m.how}`);
  assert.ok(!contentWords(sandwich).has('lunch'), '"lunch" is still counted as a food');
  return 'the fuller account wins';
});

check('AND SO IS EVERYBODY ELSE\'S BREAKFAST', () => {
  // The short-entry path, which the first fix did not reach.
  for (const [a, b] of [
    ['porridge for breakfast', 'porridge'],
    ['chicken salad', 'chicken salad for dinner'],
    ['snack of almonds', 'almonds'],
  ]) {
    const m = sameMeal(a, b);
    assert.ok(m, `"${a}" and "${b}" are still two entries`);
    assert.strictEqual(m.how, 'same');
  }
  return 'three ordinary sentences, one entry each';
});

check('AND TWO DIFFERENT FOODS ARE STILL TWO', () => {
  // The fix must cost nothing it was not meant to cost.
  assert.strictEqual(sameMeal('apple', 'orange'), null, 'an apple and an orange merged');
  assert.strictEqual(sameMeal('porridge', 'toast'), null, 'porridge and toast merged');
  assert.strictEqual(
    sameMeal('chicken salad for lunch', 'tuna salad for lunch'),
    null,
    'two different salads merged because they were both lunch'
  );
  return 'different food is still different';
});

check('TEA IS A DRINK AND STAYS ONE', () => {
  // The ambiguous word is left alone on purpose: in British usage it is a meal
  // AND a drink, and dropping it would let a cup of tea and a biscuit collapse.
  assert.ok(!MEAL_WORDS.has('tea'), 'tea was dropped, and it is a drink as often as a meal');
  assert.strictEqual(sameMeal('a cup of tea', 'a biscuit'), null, 'tea and a biscuit merged');
  assert.ok(contentWords('a cup of tea').has('tea'), 'tea is no longer a content word');
  return 'tea still distinguishes';
});

check('AND A SHORT ENTRY STILL ONLY MERGES INSIDE TWO MINUTES', () => {
  // The tight window is what makes the short path safe, and widening it is the
  // obvious wrong way to fix the above. A second cup of tea an hour later is a
  // second cup of tea.
  assert.strictEqual(SHORT_REPEAT_WINDOW_MIN, 2, `the short window is now ${SHORT_REPEAT_WINDOW_MIN} minutes`);
  const recent = [{ id: '1', raw_text: 'porridge', happened_at: '2026-10-21T08:00:00Z' }];
  const soon = findSameMeal('porridge for breakfast', '2026-10-21T08:01:00Z', recent);
  assert.ok(soon, 'a repeat a minute later was not caught');
  const later = findSameMeal('porridge for breakfast', '2026-10-21T09:00:00Z', recent);
  assert.strictEqual(later, null, 'a second bowl an hour later was merged away');
  return 'a minute merges, an hour does not';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
