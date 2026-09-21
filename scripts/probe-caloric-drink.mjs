// A DRINK WITH CALORIES IN IT IS FOOD (Bug 17).
//
// Ruth, 21 September 2026: "Tea with milk is currently being logged as
// hydration only, with no calories captured ... Plain water, black tea, black
// coffee, and herbal tea can sit in water tracking. Anything caloric needs to
// log macros too."
//
// And, on whether the volume still counts: "macros AND its volume as water".
//
//   npx tsx scripts/probe-caloric-drink.mjs

import { drinkHasCalories, drinkIsAlcohol, drinkRouting } from '../app/lib/caloric-drink.ts';

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

group('her exact bug');

check('tea with milk', drinkHasCalories('tea with milk'), true);
check('a milky tea', drinkHasCalories('mug of tea with a splash of milk'), true);
check('coffee with sugar', drinkHasCalories('coffee with two sugars'), true);
check('a latte', drinkHasCalories('latte'), true);
check('hot chocolate', drinkHasCalories('a hot chocolate'), true);

group('what she said can stay in water tracking');

check('plain water', drinkHasCalories('a glass of water'), false);
check('black tea', drinkHasCalories('black tea'), false);
check('black coffee', drinkHasCalories('black coffee'), false);
check('herbal tea', drinkHasCalories('herbal tea'), false);
check('peppermint tea', drinkHasCalories('peppermint tea'), false);
check('sparkling water', drinkHasCalories('sparkling water'), false);

group('a denial beats the word inside it');

// THE TROUBLE SOMEBODY WENT TO must not be what trips the guard. "Sugar free"
// contains the word sugar; firing on it would punish the clearest possible
// statement that a drink is not caloric.
check('sugar free squash', drinkHasCalories('sugar free squash'), false);
check('sugar-free', drinkHasCalories('sugar-free lemonade'), false);
check('no sugar', drinkHasCalories('coffee, no sugar'), false);
check('tea with no milk', drinkHasCalories('tea with no milk'), false);
check('diet coke', drinkHasCalories('diet coke'), false);
// A DENIAL CANCELS ONLY WHAT IT DENIES. The first version of this guard
// cancelled everything, so "unsweetened almond milk" came back calorie-free.
// Unsweetened is a statement about the sugar; it says nothing about the almonds.
check('unsweetened almond milk is still caloric', drinkHasCalories('unsweetened almond milk'), true);
check('a skinny latte is still a latte', drinkHasCalories('skinny latte'), true);
check('unsweetened tea with milk is still milky', drinkHasCalories('unsweetened tea with milk'), true);
check('sugar free with milk is still milky', drinkHasCalories('sugar free syrup latte'), true);

group('bare tea and coffee are left to the model');

// DELIBERATELY NOT DECIDED HERE. In Britain "a mug of tea" usually has milk and
// "a cup of green tea" does not, and only the conversation can tell. A
// heuristic in code would have to guess, and a guess writes a wrong row either
// way. The prompt handles the reading; this file handles what cannot be argued.
check('bare tea', drinkHasCalories('a mug of tea'), false);
check('bare coffee', drinkHasCalories('a coffee'), false);
check('nothing', drinkHasCalories(null), false);
check('empty', drinkHasCalories('   '), false);

group('alcohol');

check('a pint', drinkIsAlcohol('a pint of lager'), true);
check('wine', drinkIsAlcohol('large glass of red wine'), true);
check('a cocktail', drinkIsAlcohol('two cocktails'), true);
check('gin and tonic', drinkIsAlcohol('gin and tonic'), true);
check('water is not alcohol', drinkIsAlcohol('water'), false);
check('alcohol free beer', drinkIsAlcohol('alcohol free beer'), false);
check('a mocktail', drinkIsAlcohol('mocktail'), false);

group('what each one should actually do');

// THE WHOLE POINT: both axes, because both are true.
check('a milky tea does both', drinkRouting('tea with milk'), { macros: true, water: true });
check('plain water is water only', drinkRouting('a glass of water'), { macros: false, water: true });
check('black coffee is water only', drinkRouting('black coffee'), { macros: false, water: true });
// ALCOHOL IS THE ONE DRINK WHOSE VOLUME MUST NOT REACH THE WATER FIGURE. It has
// calories, so it logs as food - but it is a diuretic, and a good hydration day
// built out of wine would be a false day.
check('wine is food and not water', drinkRouting('glass of wine'), { macros: true, water: false });
check('a pint is food and not water', drinkRouting('a pint of cider'), { macros: true, water: false });
check('alcohol free beer still hydrates', drinkRouting('alcohol free beer'), { macros: false, water: true });

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
