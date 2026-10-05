// CAN SOMETHING APPEAR UNDER A HEADING THAT MEANS SOMETHING ELSE?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-allergy-kinds.mjs
//
// Ruth, 2 October 2026, item 5: setup groups these by KIND - "on your plate"
// (THE ONLY KIND THAT ARMS THE FOOD FILTER), "skin and air", "medicines you
// react to", "movements to leave out of sessions", and "other". And: "Nickel and
// hay fever must not appear under your plate."
//
// WHY THAT IS A SAFETY REQUIREMENT AND NOT A LAYOUT ONE. The food filter acts on
// kind 'food' and on kind 'other' - 'other' deliberately, because an unexplained
// allergy in a food app is conservatively treated as edible. In September nickel
// was stored with no kind, became 'other', and blocked two plain questions about
// nickel within a minute. The heading a woman reads and the `kind` the gate
// switches on have to be the same decision, or the screen promises one thing and
// the database does another.
//
// THE REVERSE DIRECTION IS WORSE AND IS CHECKED TOO. A food allergy filed under
// a heading that does NOT arm the filter would mean peanuts stored in a way the
// gate ignores. That is the failure nobody notices until it matters.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const cwd = process.cwd().replace(/\\/g, '/');
const OPTIONS = await import(`file://${cwd}/mobile/src/lib/allergy-options.ts`);
const SERVER = await import(`file://${cwd}/app/lib/allergies.ts`);

const {
  FOOD_ALLERGIES,
  DIETARY_NEEDS,
  OTHER_REACTIONS,
  MEDICINE_REACTIONS,
  ALL_ALLERGY_OPTIONS,
} = OPTIONS;
const { filtersFood, recordAllergies } = SERVER;

const SCREEN = readFileSync('mobile/src/app/onboarding/allergies.tsx', 'utf8');

let pass = 0;
const failures = [];
// AWAITED, BECAUSE TWO OF THESE ARE ASYNC AND THE FIRST VERSION WAS NOT.
//
// It called fn(), got a Promise back, printed "PASS ... [object Promise]" and
// counted it - so the two cases covering what recordAllergies does with an
// unrecognised kind, which is the conservative-direction safety check, never ran
// their assertions at all. Both reported passing.
//
// A CHECK THAT CANNOT FAIL IS WORSE THAN A MISSING ONE, because the report says
// somebody verified it. Caught here only because the note printed as
// "[object Promise]"; with a note of `undefined` it would have looked perfect.
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const arms = (kind) => filtersFood({ name: 'x', disclosed_at: '', kind });

console.log('\n  WHAT ARMS THE FOOD FILTER, AND WHAT SHE IS TOLD\n');

await check('only food and other arm the food filter', () => {
  assert.strictEqual(arms('food'), true);
  assert.strictEqual(arms('other'), true, "'other' must stay conservative");
  assert.strictEqual(arms('contact'), false);
  assert.strictEqual(arms('environmental'), false);
  assert.strictEqual(arms('medicine'), false, 'a medicine became a food restriction');
  return 'food and other yes; contact, environmental, medicine no';
});

await check('HER RULE: nickel and hay fever cannot reach the food filter', () => {
  for (const name of ['nickel', 'pollen']) {
    const option = ALL_ALLERGY_OPTIONS.find((o) => o.name === name);
    assert.ok(option, `${name} is not offered at all`);
    assert.strictEqual(
      arms(option.kind),
      false,
      `${option.label} has kind "${option.kind}", which arms the food filter`
    );
  }
  return 'nickel is contact, pollen is environmental';
});

await check('every skin-and-air option stays out of the food filter', () => {
  for (const o of OTHER_REACTIONS) {
    assert.strictEqual(arms(o.kind), false, `${o.label} (${o.kind}) arms the food filter`);
  }
  return `${OTHER_REACTIONS.length} options, none of them food`;
});

await check('every medicine is kind medicine, and none of them is food', () => {
  for (const o of MEDICINE_REACTIONS) {
    assert.strictEqual(o.kind, 'medicine', `${o.label} is kind "${o.kind}"`);
    assert.strictEqual(arms(o.kind), false);
  }
  assert.ok(
    MEDICINE_REACTIONS.some((o) => o.name === 'penicillin'),
    'penicillin, her own example, is not offered'
  );
  return `${MEDICINE_REACTIONS.length} medicines, none restricting food`;
});

await check('THE OTHER DIRECTION: every food thing DOES arm the filter', () => {
  // A peanut allergy stored in a way the gate ignores is the failure nobody
  // notices until it matters.
  for (const o of [...FOOD_ALLERGIES, ...DIETARY_NEEDS]) {
    assert.strictEqual(arms(o.kind), true, `${o.label} (${o.kind}) does NOT arm the food filter`);
  }
  return `${FOOD_ALLERGIES.length + DIETARY_NEEDS.length} food and diet options, all armed`;
});

await check('no option appears in two groups with different kinds', () => {
  const byName = new Map();
  for (const o of ALL_ALLERGY_OPTIONS) {
    const seen = byName.get(o.name);
    assert.ok(
      seen === undefined || seen === o.kind,
      `${o.name} is offered as both "${seen}" and "${o.kind}"`
    );
    byName.set(o.name, o.kind);
  }
  return `${byName.size} distinct names`;
});

// ------------------------------------------------- the screen's own invariant

await check('the screen asserts its groups at load, and the assertion is reachable', () => {
  assert.ok(
    /function assertGroupsMatchKinds\(\)/.test(SCREEN),
    'the screen has no invariant tying its headings to the kinds they write'
  );
  assert.ok(
    /^assertGroupsMatchKinds\(\);$/m.test(SCREEN),
    'the invariant is declared and never called, so it can never fail'
  );
  return 'declared and called at module load';
});

await check('a group holds its own kinds, read from the groups themselves', () => {
  // The group list is in a .tsx and cannot be imported without a renderer, so
  // its shape is read as text. What is verified is the thing that matters: the
  // plate group is the only one built from the food lists.
  // THE GROUPS MOVED HOUSE ON 5 OCTOBER. Her wording went to lib/steer-copy.ts
  // and the chips stayed here, joined by key - so this reads GROUP_DATA, where
  // the kinds now are, rather than the old combined list.
  const plate = SCREEN.indexOf('plate: {');
  const skin = SCREEN.indexOf('skin_air: {');
  const meds = SCREEN.indexOf('medicines: {');
  assert.ok(plate >= 0 && skin >= 0 && meds >= 0, 'her three named groups are not all present');
  const plateBlock = SCREEN.slice(plate, skin);
  assert.ok(
    /FOOD_ALLERGIES/.test(plateBlock) && /DIETARY_NEEDS/.test(plateBlock),
    'the plate group is not the food lists'
  );
  assert.ok(
    !/OTHER_REACTIONS/.test(plateBlock) && !/MEDICINE_REACTIONS/.test(plateBlock),
    'skin, air or medicines are offered under the food heading'
  );
  return 'plate is food and diet only';
});

await check('movements to leave out are NOT in this table', () => {
  // They are rules. A movement in the allergies table would be a food
  // restriction named "overhead press".
  const movementish = ALL_ALLERGY_OPTIONS.filter((o) =>
    /press|squat|lunge|jump|plank|burpee|overhead|deadlift/i.test(o.name)
  );
  assert.deepStrictEqual(movementish, [], 'a movement is being stored as an allergy');
  assert.ok(
    /user_rules|rules/i.test(SCREEN) === false || /movement/i.test(SCREEN),
    'the screen is unclear about where movements go'
  );
  return 'exclusions live in user_rules, not here';
});

// ------------------------------------------------- an unknown kind stays safe

await check('a kind nobody recognises still arms the food filter', async () => {
  // recordAllergies coerces anything it does not know to 'other', which arms the
  // filter. That is the conservative direction and the whole reason 'other'
  // behaves as food. A model inventing "inhaled" must not switch the gate off.
  const captured = [];
  const fake = {
    from: () => ({
      upsert: (rows) => {
        captured.push(...rows);
        return Promise.resolve({ error: null });
      },
    }),
  };
  return recordAllergies(fake, 'u1', [{ name: 'Something Odd', kind: 'inhaled' }], 'raw').then(
    () => {
      assert.strictEqual(captured.length, 1, 'nothing was written');
      assert.strictEqual(captured[0].kind, 'other', `an unknown kind became "${captured[0].kind}"`);
      assert.strictEqual(arms(captured[0].kind), true, 'an unknown kind stopped filtering food');
      return 'an invented kind becomes other, which still filters';
    }
  );
});

await check('a medicine kind from chat survives as a medicine', async () => {
  const captured = [];
  const fake = {
    from: () => ({
      upsert: (rows) => {
        captured.push(...rows);
        return Promise.resolve({ error: null });
      },
    }),
  };
  return recordAllergies(fake, 'u1', [{ name: 'Penicillin', kind: 'medicine' }], 'raw').then(() => {
    assert.strictEqual(captured[0].kind, 'medicine', `became "${captured[0].kind}"`);
    return 'not downgraded to other, so it does not restrict food';
  });
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
