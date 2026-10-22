// A COMPLAINT IS NOT A MEAL, AND NEITHER IS A PHOTOGRAPH OF NOTHING.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-photo-of-nothing-is-not-a-meal.mjs
//
// hasFood was written on 16 September 2026, in a commit called "A week of food
// can be caught up in one message, and a complaint is not a meal". It was
// applied to the chat path, where buildFoodRows filters every entry through it.
//
// IT WAS NEVER APPLIED TO THE PHOTO PATH. api/parse-food inserts straight into
// food_logs, and found in her own record on 22 October 2026 were three rows
// carrying no food at all - one of them dated 17 September, the day AFTER the
// guard shipped:
//
//   raw_text                                     meal_label        items
//   "I want to reduce body fat..."               No food entry         0
//   "I'd already had a couple of mouthfuls."     Partial intake        0
//   ""                                           Unknown               0
//
// THE MODEL KNEW. It wrote "No food entry" into the label, returned no items
// and no calories, and the row went in anyway - into her log, her daily totals
// and every weekly average since.
//
// This is the guard-at-the-write rule the project already holds, failing in the
// way it usually fails: the guard existed, was correct, and one of the two
// doors into the room did not have it.
//
// AND BLACK COFFEE MUST SURVIVE. Hers is 0 kcal with one item, which is a real
// drink honestly recorded. An item is food whatever it weighs, which is why
// hasFood tests items before it tests calories.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { hasFood } = await import(here('app/lib/food-logging.ts'));

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

const route = fs.readFileSync('app/api/parse-food/route.ts', 'utf8');
const phone = fs.readFileSync('mobile/src/lib/image-logging.ts', 'utf8');

console.log('\n  A PHOTOGRAPH OF NOTHING IS NOT A MEAL\n');

check('HER THREE ROWS WOULD BE REFUSED NOW', () => {
  // Exactly as they were stored, which is how they were found.
  const junk = [
    { meal_label: 'No food entry', kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, items: [] },
    { meal_label: 'Partial intake', kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, items: [] },
    { meal_label: 'Unknown', kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, items: [] },
  ];
  for (const row of junk) {
    assert.strictEqual(hasFood(row), false, `"${row.meal_label}" still counts as food`);
  }
  return 'all three';
});

check('AND BLACK COFFEE STILL GOES IN', () => {
  // 0 kcal with one item. The cost of a cruder guard - "no calories, no row" -
  // would be deleting a real drink she honestly recorded.
  const coffee = {
    meal_label: 'Beverage',
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    items: [{ name: 'black coffee', kcal: 0 }],
  };
  assert.strictEqual(hasFood(coffee), true, 'a zero-calorie drink was refused');
  // And anything with calories, obviously.
  assert.strictEqual(hasFood({ kcal: 420, items: [] }), true);
  return 'an item is food whatever it weighs';
});

check('THE PHOTO PATH ACTUALLY APPLIES IT', () => {
  // The wire, which is the whole fault: the guard existed and was correct, and
  // this door did not have it.
  assert.ok(/hasFood\(/.test(route), 'api/parse-food still writes whatever it is given');
  const at = route.indexOf('hasFood(');
  const insertAt = route.indexOf(".from('food_logs')");
  assert.ok(at > -1 && insertAt > -1, 'the guard or the insert has moved');
  assert.ok(at < insertAt, 'the guard runs after the row has already been written');
  assert.ok(/nothingToLog: true/.test(route), 'a refusal is not reported to the phone');
  return 'before the insert';
});

check('AND THE PHONE SAYS SO RATHER THAN DESCRIBING A MEAL', () => {
  // Handing an empty response to foodAckFacts produces prose about a log that
  // never happened - the "weird" thing she named about the duplicate weigh-in.
  assert.ok(/nothing_to_log/.test(phone), 'the phone has no state for it');
  assert.ok(/saved\?\.nothingToLog/.test(phone), 'the phone ignores the refusal');
  const at = phone.indexOf("if (saved?.nothingToLog)");
  const ack = phone.indexOf('foodAckFacts(saved as never)');
  assert.ok(at > -1 && at < ack, 'the acknowledgment is built before the refusal is read');
  assert.ok(/could not see anything/i.test(phone), 'nothing is said to her');
  // IN WORLD AND WITHOUT BLAME, and offering the way forward - photographing a
  // menu or a recipe is an ordinary thing to do.
  assert.ok(/Tell me what it was/i.test(phone), 'it names the problem and offers nothing');
  return 'said once, in her words, with a way on';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
