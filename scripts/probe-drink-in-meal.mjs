// A DRINK NAMED ALONGSIDE FOOD (Ruth, 23 September 2026).
//
//   Sent:      "Chicken salad with avocado and a flat white for lunch"
//   Reply:     "Got it - the chicken salad with avocado and the flat white are added."
//   items:     Chicken, Salad, Avocado
//   hydration: nothing
//
// Two separate failures, and both had to be fixed:
//
//   1. The model left the drink out of `items` AND out of `drinks`, despite a
//      prompt that says in capitals that no drink may be left out for any
//      reason. So `reconcileDrinks` now reads the drinks back out of the
//      person's own words.
//   2. `parseVolumeMl` had never heard of a flat white. Its drink vocabulary
//      was seven words long and stopped at "brew", so even a flat white that
//      DID reach it measured as nothing.
//
// Pure functions only. No model, no database, no network.
//
//   npx tsx scripts/probe-drink-in-meal.mjs

import { drinksNamedIn, mentionsDrink, drinkRouting, DRINK_NOUNS } from '../app/lib/caloric-drink.ts';
import { parseVolumeMl } from '../app/lib/hydration-logging.ts';
import { underItemised, drinkMissingFromItems } from '../app/lib/itemisation.ts';
import { reconcileDrinks } from '../app/lib/food-logging.ts';

let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) console.log(`        ${detail}`);
  }
}

console.log('\n  FINDING A DRINK NOBODY HANDED US\n');

// ---- the entry that started it -------------------------------------------
{
  const text = 'chicken salad with avocado, flat white';
  const found = drinksNamedIn(text);
  check('her lunch: the flat white is found in the text', found.some((d) => d.noun === 'flat white'), JSON.stringify(found));
  check('and nothing else is mistaken for a drink', found.length === 1, JSON.stringify(found));

  const items = [{ name: 'Chicken' }, { name: 'Salad' }, { name: 'Avocado' }];
  check('three items and no drink reads as under-itemised', drinkMissingFromItems(text, items));
  check('...and so the retry fires', underItemised(text, items));
  check('with the drink present it does not', !drinkMissingFromItems(text, [...items, { name: 'Flat white' }]));

  const drinks = reconcileDrinks([], text);
  check('the drink is recovered for hydration', drinks.length === 1, JSON.stringify(drinks));
  check('and it measures as a real volume', parseVolumeMl(drinks[0]) > 0, String(parseVolumeMl(drinks[0])));
}

// ---- the vocabulary that was missing --------------------------------------
{
  const espresso = ['flat white', 'latte', 'cappuccino', 'americano', 'mocha', 'cortado', 'macchiato', 'espresso'];
  for (const d of espresso) {
    check(`"${d}" has a volume`, parseVolumeMl(d) > 0, String(parseVolumeMl(d)));
  }
  check('a latte carries calories', drinkRouting('latte').macros);
  check('a latte is hydration too', drinkRouting('latte').water);
}

// ---- counts still survive the run-up --------------------------------------
{
  check('three black coffees is three', parseVolumeMl('three black coffees') === 750, String(parseVolumeMl('three black coffees')));
  const found = drinksNamedIn('three black coffees');
  check('...and the count comes back with the drink', found[0].phrase === 'three black coffees', JSON.stringify(found));
  check('two lattes is two', parseVolumeMl(drinksNamedIn('two lattes')[0].phrase) === 500, JSON.stringify(drinksNamedIn('two lattes')));
}

// ---- things that are not drinks -------------------------------------------
{
  check('coffee cake is cake', drinksNamedIn('a slice of coffee cake').length === 0, JSON.stringify(drinksNamedIn('a slice of coffee cake')));
  check('milk chocolate is chocolate', drinksNamedIn('20g milk chocolate').length === 0, JSON.stringify(drinksNamedIn('20g milk chocolate')));
  check('a rum truffle is a truffle', drinksNamedIn('two rum truffles').length === 0, JSON.stringify(drinksNamedIn('two rum truffles')));
  check('hot chocolate IS a drink', drinksNamedIn('a hot chocolate').length === 1, JSON.stringify(drinksNamedIn('a hot chocolate')));
  check('...and is not also reported as a chocolate', drinksNamedIn('a hot chocolate').length === 1);
}

// ---- nothing the model said is thrown away --------------------------------
{
  const kept = reconcileDrinks(['a mug of tea with milk'], 'mug of tea with milk and a cookie');
  check('the model wording is kept, not replaced', kept.length === 1 && kept[0] === 'a mug of tea with milk', JSON.stringify(kept));

  const both = reconcileDrinks(['1lt water'], 'porridge, 1lt water and a flat white');
  check('an omission is added beside what came back', both.length === 2, JSON.stringify(both));
  check('the litre still measures as a litre', parseVolumeMl('1lt water') === 1000, String(parseVolumeMl('1lt water')));
}

// ---- alcohol keeps its rule -----------------------------------------------
{
  const found = drinksNamedIn('steak and two glasses of red wine');
  check('wine is found', found.length === 1, JSON.stringify(found));
  check('wine carries calories', drinkRouting(found[0].phrase).macros);
  check('wine is NOT hydration', drinkRouting(found[0].phrase).water === false);
}

// ---- a meal with no drink in it is left alone ------------------------------
{
  const text = 'chicken salad with avocado';
  check('no drink named, nothing invented', drinksNamedIn(text).length === 0);
  check('and the retry does not fire on it', !drinkMissingFromItems(text, [{ name: 'Chicken' }, { name: 'Salad' }]));
}

// ---- what counts as the drink already being there --------------------------
{
  check('an item called "Flat white" accounts for a flat white', mentionsDrink('Flat white', 'flat white'));
  check('an item called "Coffee" accounts for coffee', mentionsDrink('Coffee', 'coffee'));
  check('an item called "Chicken" does not', !mentionsDrink('Chicken', 'flat white'));
  check('tea is not coffee', !mentionsDrink('tea', 'coffee'));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
console.log(`  (${DRINK_NOUNS.length} drinks in the vocabulary)\n`);
process.exit(fail === 0 ? 0 : 1);
