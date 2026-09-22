// A LITRE OF WATER TYPED IN THE MIDDLE OF A MEAL.
//
// Ruth, 21 September 2026: "I logged 1lt of water in food log in typed entry
// and it didnt show up in the chat text, the table or the hydration log."
//
// Her entry was "5 chocolate almonds, 1 chocolate caramel Malteser sized, 150g
// mango, black coffee, 1lt water" and the reply said "the litre of water's in
// too". It was not.
//
//   npx tsx scripts/probe-water-in-food.mjs

import { parseVolumeMl } from '../app/lib/hydration-logging.ts';
import { waterFromDrinks } from '../app/lib/water-in-food.ts';

let passed = 0;
let failed = 0;

function group(name) {
  console.log(`\n  ${name.toUpperCase()}\n`);
}

function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  }
}

group('the unit she actually typed');

// THE WHOLE BUG IN ONE CASE. "1lt" fell past the explicit-volume branch to the
// no-quantity default, so even once it reached hydration it would have been
// recorded as a single glass - and a litre stored as 250ml is worse than a
// litre stored as nothing, because nobody would ever notice.
check('1lt', parseVolumeMl('1lt water'), 1000);
check('1 lt', parseVolumeMl('1 lt water'), 1000);
check('2ltr', parseVolumeMl('2ltr water'), 2000);
check('1L', parseVolumeMl('1L water'), 1000);
check('1 litre', parseVolumeMl('1 litre of water'), 1000);
check('500ml', parseVolumeMl('500ml water'), 500);
check('500 mls', parseVolumeMl('500 mls water'), 500);
check('a pint', parseVolumeMl('a pint of squash'), 568);
check('two mugs', parseVolumeMl('2 mugs of tea'), 600);
// WRITTEN NUMBERS, because people type "two mugs of tea" far more often than
// "2 mugs". This was falling through to the one-glass default and recording
// 250ml instead of 600 - found while fixing Bug 17, not by looking for it.
check('two mugs, written out', parseVolumeMl('two mugs of tea'), 600);
check('a couple of glasses', parseVolumeMl('a couple of glasses of water'), 500);
check('three cups', parseVolumeMl('three cups of coffee'), 900);
check('one glass', parseVolumeMl('one glass of water'), 250);
// A DRINK WITH NO QUANTITY IS ONE ORDINARY GLASS, which was already the rule.
check('black coffee', parseVolumeMl('black coffee'), 250);

group('her exact entry');

// The model names the drinks; this measures them. The chocolate and the mango
// are not its business.
check('the litre and the coffee', waterFromDrinks(['1lt water', 'black coffee']), {
  ml: 1250,
  from: ['1lt water', 'black coffee'],
});

group('what it adds up and what it leaves out');

check('nothing named', waterFromDrinks([]), { ml: 0, from: [] });
check('nothing at all', waterFromDrinks(undefined), { ml: 0, from: [] });
check('a blank string', waterFromDrinks(['  ']), { ml: 0, from: [] });
// A PHRASE THAT YIELDS NOTHING IS DROPPED, not guessed at.
check('an unmeasurable phrase', waterFromDrinks(['a drink']), { ml: 0, from: [] });
check('the measurable one survives beside it', waterFromDrinks(['a drink', '500ml water']), {
  ml: 500,
  from: ['500ml water'],
});
// A CEILING, because a model that returns ten litres has misread something, and
// a ten-litre day would quietly wreck every water figure afterwards.
check('an absurd volume is refused', waterFromDrinks(['10 litres of water']), { ml: 0, from: [] });
check('five litres is still allowed', waterFromDrinks(['5 litres of water']).ml, 5000);
check('several drinks add up', waterFromDrinks(['500ml water', '2 mugs of tea']).ml, 1100);

group('bug 17: what reaches the water figure');

// A MILKY TEA IS BOTH, which is what Ruth chose: "macros AND its volume as
// water". Its macros come from the food parse; this is the volume half.
check('a milky tea still hydrates', waterFromDrinks(['two mugs of tea with milk']).ml, 600);
check('juice hydrates', waterFromDrinks(['a glass of orange juice']).ml, 250);

// ALCOHOL IS THE EXCEPTION. It logs as food like any caloric drink, but its
// volume must never reach the water figure: alcohol is a diuretic, and a good
// hydration day built out of wine would be a false day.
check('a pint of cider is not water', waterFromDrinks(['a pint of cider']), { ml: 0, from: [] });
check('wine is not water', waterFromDrinks(['2 glasses of wine']), { ml: 0, from: [] });
check('a cocktail is not water', waterFromDrinks(['a mojito']), { ml: 0, from: [] });
// AND THE WATER BESIDE IT STILL COUNTS, which is the case that matters on a
// night out - the evening should not lose its water because it also had wine.
check('water beside the wine survives', waterFromDrinks(['2 glasses of wine', '500ml water']), {
  ml: 500,
  from: ['500ml water'],
});
check('alcohol free beer hydrates', waterFromDrinks(['a bottle of alcohol free beer']).ml, 500);

group('a drink named without a vessel');

// HER ENTRY, 22 September: "three black coffees" was logged as food and
// recorded as no hydration at all, because the word boundary after "coffee"
// does not match "coffees". The plural fell straight through.
check('three black coffees', parseVolumeMl('three black coffees'), 750);
check('one black coffee', parseVolumeMl('black coffee'), 250);
check('2 coffees in digits', parseVolumeMl('2 coffees'), 500);
check('a herbal tea', parseVolumeMl('a herbal tea'), 250);
check('teas, plural', parseVolumeMl('two teas'), 500);
check('waters, plural', parseVolumeMl('two waters'), 500);
// A COUNT STILL LOSES TO A STATED VOLUME, which is the more precise thing.
check('a stated volume wins', parseVolumeMl('500ml of coffee'), 500);
check('a vessel wins too', parseVolumeMl('two mugs of coffee'), 600);
// A TURN OF PHRASE IS NOT FIVE LITRES.
check('an absurd count is capped', parseVolumeMl('20 coffees'), 3000);
check('still not a drink', parseVolumeMl('a slice of coffee cake'), 250);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
