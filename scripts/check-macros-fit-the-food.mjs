// THE MACROS CANNOT WEIGH MORE THAN THE FOOD.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-macros-fit-the-food.mjs
//
// The case this is built from is real and is in her log:
//
//   80g bakery sausage roll   280 kcal   9p 22c 17f  = 48g of macros in 80g   ok
//   20g bakery sausage roll   180 kcal   6p 14c 11f  = 31g of macros in 20g   impossible
//
// The second one is internally consistent - 6x4 + 14x4 + 11x9 = 179, matching
// its 180 kcal - so every check that tests calories against macros passes it.
// It is a correct estimate of the wrong amount of food. The only thing that
// gives it away is that the macronutrients outweigh the thing containing them.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { statedGrams, weightIsPossible } = await import(root + '/app/lib/food-weight-sanity.ts');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// -- reading the weight out of her own words -------------------------------

check('plain grams', () => assert.equal(statedGrams('20g bakery sausage roll'), 20));
check('a space before the unit', () => assert.equal(statedGrams('100 g greek yoghurt'), 100));
check('the word spelled out', () => assert.equal(statedGrams('250 grams of pasta'), 250));
check('kilograms become grams', () => assert.equal(statedGrams('1.5kg chicken'), 1500));
check('no weight at all', () => assert.equal(statedGrams('a banana'), null));
check('a weight that is not food', () => {
  // "half of a 400g tin" describes the tin; the portion is what matters, and
  // when only the tin is named the last number is still the best available.
  assert.equal(statedGrams('half of a 400g tin of beans'), 400);
});
check('millilitres are not grams', () => assert.equal(statedGrams('200ml milk'), null));

// -- the real entries ------------------------------------------------------

check('her 20g sausage roll is caught', () => {
  const v = weightIsPossible('20g bakery sausage roll', { protein_g: 6, carbs_g: 14, fat_g: 11 });
  assert.equal(v.ok, false, 'the entry that started this passed');
  assert.equal(v.statedG, 20);
  assert.equal(v.macroG, 31);
  assert.match(v.note, /cannot be right/i);
});

check('her 80g sausage roll is left alone', () => {
  const v = weightIsPossible('80g bakery sausage roll', { protein_g: 9, carbs_g: 22, fat_g: 17 });
  assert.equal(v.ok, true, 'a plausible entry was flagged, which is worse than missing one');
});

check('the note never offers a replacement figure', () => {
  const v = weightIsPossible('20g bakery sausage roll', { protein_g: 6, carbs_g: 14, fat_g: 11 });
  assert.doesNotMatch(
    v.note,
    /\b\d+\s*(kcal|calories)\b/i,
    'it is suggesting a corrected calorie figure, which is a second guess dressed as a fix'
  );
});

// -- the things it must not fire on ----------------------------------------
//
// This is the whole risk. A guard that flags correct entries gets switched off.

check('an entry with no weight is never judged', () => {
  assert.equal(weightIsPossible('a banana', { protein_g: 1.3, carbs_g: 27, fat_g: 0.3 }).ok, true);
});

check('rounding alone does not trip it', () => {
  // Every macro reported whole can push a 100g food to 101g on its own.
  assert.equal(weightIsPossible('100g x', { protein_g: 30, carbs_g: 40, fat_g: 31 }).ok, true);
});

check('a food that is almost all macronutrient passes', () => {
  // 100g of sugar is ~100g of carbohydrate, and that is correct.
  assert.equal(weightIsPossible('100g sugar', { protein_g: 0, carbs_g: 100, fat_g: 0 }).ok, true);
});

check('missing macros are not treated as a violation', () => {
  assert.equal(weightIsPossible('20g x', { protein_g: null, carbs_g: null, fat_g: null }).ok, true);
});

check('a large food with large macros passes', () => {
  assert.equal(weightIsPossible('500g chicken', { protein_g: 150, carbs_g: 0, fat_g: 40 }).ok, true);
});

// -- the rule reaches BOTH prompt paths, and the guard actually runs -------
//
// food-logging.ts builds its instruction two ways: one for a correction of a
// single entry, one for a message that may describe several meals. They had
// DRIFTED - the multi-entry branch carried neither the omit-rather-than-guess
// rule nor the weight rule, and the multi-entry branch is the one that handled
// "20g more sausage roll". One fact, two declarations, and only one of them
// updated: the shape this repository keeps meeting.

// Line endings normalised: the repository's TypeScript is CRLF and the anchors
// below are written with bare newlines.
const FOOD_LOGGING = readFileSync('app/lib/food-logging.ts', 'utf8').replace(/\r\n/g, '\n');

check('both prompt branches carry the stated-weight rule', () => {
  const uses = FOOD_LOGGING.split('FOOD_PARSE_STATED_WEIGHT_IS_BINDING +').length - 1;
  const branches = FOOD_LOGGING.split('FOOD_PARSE_CLASSIFICATION_RULES +').length - 1;
  assert.equal(
    uses,
    branches,
    `${branches} prompt branch(es) but the weight rule is in ${uses} - they have drifted again`
  );
});

check('both prompt branches say what time it is', () => {
  const uses = FOOD_LOGGING.split("IT IS NOW ' + nowLocal").length - 1;
  assert.ok(uses >= 2, `the clock reaches ${uses} prompt branch(es), not both`);
});

check('the guard is wired into the write path, not just written', () => {
  assert.match(
    FOOD_LOGGING,
    /weightIsPossible\(/,
    'food-weight-sanity is imported by nobody, which makes it a document rather '
      + 'than a guard - the exact pattern already written down in DECISION_PATTERNS'
  );
  assert.match(
    FOOD_LOGGING,
    /macros outweigh the food/,
    'nothing records when the guard fires, so there is no way to find out whether '
      + 'the prompt rule was enough'
  );
});
// -- every case above must be able to fail ---------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('the impossible entry is caught', () =>
  assert.equal(
    weightIsPossible('20g bakery sausage roll', { protein_g: 6, carbs_g: 14, fat_g: 11 }).ok,
    true
  )
);
mustFail('the possible entry is spared', () =>
  assert.equal(
    weightIsPossible('80g bakery sausage roll', { protein_g: 9, carbs_g: 22, fat_g: 17 }).ok,
    false
  )
);
mustFail('grams are read', () => assert.equal(statedGrams('20g x'), null));
mustFail('kg is converted', () => assert.equal(statedGrams('1.5kg x'), 1.5));

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
