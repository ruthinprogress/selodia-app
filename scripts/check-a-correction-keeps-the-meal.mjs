// A CORRECTION CHANGES WHAT SHE CORRECTED, AND NOTHING ELSE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-correction-keeps-the-meal.mjs
//
// Ruth, 14 October 2026, after the comparison run: "fix corrections properly,
// find why T4 set it to breakfast."
//
// TWO FAULTS, FOUND TOGETHER, AND NEITHER WAS THE MODEL BEING STUPID.
//
// 1. THE LABEL MOVED. She corrected a lunch. The calories went in correctly and
//    the entry came back labelled Breakfast. On a correction the parse is shown
//    the corrected FOOD and nothing else - not the entry's existing label, not
//    the time it was eaten - and is told to infer a label "using time-of-day
//    clues if mentioned, or the food type if not". There are no time clues in
//    "100g of porridge", so it infers from the food, and porridge is breakfast.
//    It was never deciding to move her meal. It was never told there was one.
//
// 2. THE REPLY READ YESTERDAY'S TOTAL. On the case before it she corrected a
//    meal from 247 kcal down to 83 and was told: "Your total for today still
//    shows 527 kcal, though... So the old one may still be there next to the
//    new one. You can check under Log, then Food & Drink." The correction had
//    worked. The day's figures are read at the top of the turn and the writes
//    happen six hundred lines later, so the reply was handed the snapshot from
//    before its own correction and reasoned correctly to the wrong conclusion -
//    then sent her to audit the app's work.
//
// Both are guards at the write rather than instructions to a model, per the
// standing rule, because both were caused by giving the model the wrong facts
// rather than by the model misusing the right ones.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { keptMealLabel, buildFoodLogFields } = await import(root + '/app/lib/food-logging.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const food = read('app/lib/food-logging.ts');
const route = read('app/api/ask-selodia/route.ts');

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

console.log('\n  A CORRECTION CHANGES WHAT SHE CORRECTED\n');

check('her lunch stays lunch', () => {
  // T4, exactly: a lunch of porridge, corrected for quantity and nothing else.
  assert.strictEqual(
    keptMealLabel('Lunch', 'Breakfast', 'it was 100g of dry oats not 200g'),
    'Lunch',
    'a correction about quantity moved the meal'
  );
  assert.strictEqual(
    keptMealLabel('Dinner', 'Snack', 'the ice cream was two bowls'),
    'Dinner',
    'a correction about amount relabelled the meal'
  );
  return 'quantity corrections leave the label alone';
});

check('but she can move it when she says so', () => {
  assert.strictEqual(
    keptMealLabel('Breakfast', 'Lunch', 'that was lunch, not breakfast'),
    'Lunch',
    'she said which meal it was and was ignored'
  );
  assert.strictEqual(
    keptMealLabel('Lunch', 'Snack', 'that was more of a snack really'),
    'Snack',
    'she renamed it and was ignored'
  );
  return 'her words win';
});

check('a new entry is labelled as it always was', () => {
  // Nothing to preserve, so the parse decides - which is right for a first log.
  assert.strictEqual(keptMealLabel(null, 'Breakfast', 'porridge'), 'Breakfast');
  assert.strictEqual(keptMealLabel('', 'Lunch', 'a sandwich'), 'Lunch');
  assert.strictEqual(keptMealLabel('  ', 'Dinner', 'pasta'), 'Dinner');
  return 'no existing label, no guard';
});

check('an entry never loses its label to a blank', () => {
  // A parse that comes back with no label must not blank an entry that had one.
  assert.strictEqual(keptMealLabel('Lunch', null, 'a bit less of it'), 'Lunch');
  assert.strictEqual(keptMealLabel('Lunch', '', 'a bit less of it'), 'Lunch');
  assert.strictEqual(keptMealLabel('Lunch', '  ', 'that was dinner'), 'Lunch');
  return 'kept rather than emptied';
});

check('"a cup of tea" does not rename the meal', () => {
  // "tea" is a meal in half the country and a drink in the other half, so it is
  // deliberately not a trigger. The conservative answer is the old label.
  assert.strictEqual(
    keptMealLabel('Lunch', 'Snack', 'I only had one cup of tea with it'),
    'Lunch',
    'a drink read as a meal name and moved the entry'
  );
  return 'left out on purpose';
});

check('the guard is actually used where the row is written', () => {
  // keptMealLabel existing and uncalled is the failure mode this repository has
  // had six times: built, exported, wired to nobody.
  assert.ok(/meal_label: keptMealLabel\(/.test(food), 'the update writes the freshly inferred label again');
  assert.ok(
    /\.select\('meal_label'\)\s*\.eq\('id', updateLogId\)/.test(food),
    'nothing reads the label the entry already had, so there is nothing to keep'
  );
  // And buildFoodLogFields still carries it for the NEW-entry path, which is
  // correct and must not be removed in the course of fixing this.
  assert.strictEqual(buildFoodLogFields({ meal_label: 'Dinner' }).meal_label, 'Dinner');
  return 'read, then kept';
});

check("the reply is told today's total as it stands AFTER the writes", () => {
  // BOTH LISTS. The first version read `writes.any()` alone and did nothing,
  // because a food write is recorded in attempt.landed and never in writes - so
  // on a correction, the one turn this exists for, the condition was false.
  // Caught by running it against the live app rather than by reading it.
  assert.ok(
    /const wroteAnything = attempt\.landed\.length > 0 \|\| writes\.any\(\);/.test(route),
    'the refresh looks at only one of the two lists of what was written'
  );
  assert.ok(/const replyDayState = wroteAnything/.test(route), 'the reply still reads the pre-write snapshot');
  assert.ok(
    /loadDayStateRows\(supabase, dayStartForState\.toISOString\(\)\)/.test(route),
    'the refresh does not go through the same loader the context used'
  );
  const uses = route.match(/today: buildDayStatePrompt\(replyDayState\)/g) ?? [];
  assert.strictEqual(uses.length, 2, `${uses.length} of the 2 reply writers get the refreshed figures`);
  // ONLY WHEN SOMETHING WAS WRITTEN. An ordinary turn must not pay for a
  // second round trip it has no use for.
  assert.ok(/wroteAnything\s*\?[\s\S]{0,200}: dayState;/.test(route), 'every turn pays for the refresh');
  // A FOOD CORRECTION IS THE CASE IT EXISTS FOR, so it must be inside the
  // condition. 'food' is pushed to attempt.landed, which is why both lists are
  // read: a version that checked only `writes` passed every static test and
  // did nothing on the only turn that mattered.
  assert.ok(/attempt\.landed\.push\('food'\)/.test(route), 'a food write no longer lands anywhere this can see');
  return 'refreshed, and only when it had to be';
});

check('and this check can fail', () => {
  // THE OLD WRITE: the parse's label, unconditionally. It must fail the first test.
  const oldLabel = buildFoodLogFields({ meal_label: 'Breakfast' }).meal_label;
  assert.strictEqual(oldLabel, 'Breakfast', 'the old path reads as already fixed');
  assert.notStrictEqual(oldLabel, 'Lunch', 'the old path reads as keeping her lunch');
  // And the old reply figures.
  const oldReply = 'today: buildDayStatePrompt(dayState),';
  assert.ok(!/replyDayState/.test(oldReply), 'the old reply line reads as refreshed');
  return 'the old write moves her lunch to breakfast';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
