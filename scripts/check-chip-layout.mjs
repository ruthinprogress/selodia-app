// THREE CHIPS TO A ROW, AND NOTHING SHRINKS TO FIT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-chip-layout.mjs
//
// Ruth, 5 October 2026: "just put the tap chips next to each other in rows of 3
// so they don't take up so much space."
//
// WHY A CHECK AND NOT A LOOK. A wrapped grid is the one layout whose faults are
// invisible until the content arrives: a label two characters too long turns one
// row into three, and a chip carrying a hint ends the row it lands in and leaves
// a gap. lib/chip-layout.ts is a pure function of the option, so the rows every
// real chip list in the app will produce can be printed here rather than
// discovered on a phone.
//
// AND THE "WEE" RULE IS THE ONE IT ENFORCES. The tab bar lost exactly the last
// letter of every unselected label for three attempts running, because Android
// measured an autosizing label in the system face and drew it in Manrope. Nothing
// in this app may shrink text to fit or clip it. A chip too wide for a third of a
// phone takes the whole width, and this fails if any component reintroduces
// adjustsFontSizeToFit or numberOfLines on a chip.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { chipRows, chipSpan, THIRD_WIDTH_MAX_CHARS } = await import(
  root + '/mobile/src/lib/chip-layout.ts'
);
const LIFE = await import(root + '/mobile/src/lib/life-stage.ts');
const ALLERGY = await import(root + '/mobile/src/lib/allergy-options.ts');
const MOVEMENT = await import(root + '/mobile/src/lib/movement-rules.ts');

const component = readFileSync('mobile/src/components/tap-choices.tsx', 'utf8');
const code = component.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

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

console.log('\n  TAP CHIPS: THREE TO A ROW\n');

// ------------------------------------------------------------------ the rule

check('a short label takes a third and a long one takes the row', () => {
  assert.strictEqual(chipSpan({ label: 'Dairy' }), 'third');
  assert.strictEqual(chipSpan({ label: 'Prefer not to say' }), 'third');
  assert.strictEqual(chipSpan({ label: 'Impact, such as jumping' }), 'third');
  assert.strictEqual(
    chipSpan({ label: "I don't have periods for another reason" }),
    'full',
    'a thirty-eight character label is being squeezed into a third of a phone'
  );
  return `the threshold is ${THIRD_WIDTH_MAX_CHARS} characters`;
});

check('a hint always takes the whole row', () => {
  // The hint exists to hold a distinction. One that wraps every three words is
  // not a distinction anybody reads.
  assert.strictEqual(
    chipSpan({ label: 'Hormonal coil', hint: 'A copper coil is not hormonal' }),
    'full'
  );
  return 'a distinction is not wrapped three words at a time';
});

check('a full-width chip ends its row rather than reflowing the short ones', () => {
  const rows = chipRows([
    { label: 'Dairy' },
    { label: 'Gluten' },
    { label: 'A label far too long to fit in a third' },
    { label: 'Eggs' },
  ]);
  assert.deepStrictEqual(
    rows.map((r) => r.map((o) => o.label)),
    [
      ['Dairy', 'Gluten'],
      ['A label far too long to fit in a third'],
      ['Eggs'],
    ],
    'the wrapping model here does not match what flex will do'
  );
  return 'the gap is visible in a list, not only on a phone';
});

// ------------------------------------------- her real lists, as they will look

check('her period chips are two rows, not nine', () => {
  const rows = chipRows(LIFE.LIFE_STAGES);
  assert.strictEqual(rows.length, 2, `her six chips produce ${rows.length} rows`);
  for (const row of rows) assert.strictEqual(row.length, 3, 'a row is not three across');
  return rows.map((r) => r.map((o) => o.label).join(' / ')).join('  |  ');
});

check('her hormone chips fit, with the two that carry a distinction on their own', () => {
  const rows = chipRows(LIFE.HORMONE_USE_OPTIONS);
  // HRT, then the pill and the hormonal coil each with a hint, then None and
  // Prefer not to say. Four rows, and the two hinted ones are alone by design.
  assert.ok(rows.length <= 4, `${rows.length} rows is more than this question needs`);
  const hinted = LIFE.HORMONE_USE_OPTIONS.filter((o) => o.hint);
  for (const o of hinted) {
    const row = rows.find((r) => r.includes(o));
    assert.strictEqual(row.length, 1, `"${o.label}" is sharing a row with its hint showing`);
  }
  return `${rows.length} rows, ${hinted.length} of them a hint on its own`;
});

/**
 * EVERY CHIP TAKES A THIRD, asserted on the chips and not on the rows.
 *
 * The first version of these two counted rows holding one chip, which catches the
 * last row of sixteen as well as a chip that genuinely needs the width - so it
 * condemned "Kosher" for being sixteenth. The property meant is about the chip.
 */
const everyChipFits = (list, what) => {
  const wide = list.filter((o) => chipSpan(o) === 'full');
  assert.deepStrictEqual(
    wide.map((o) => o.label),
    [],
    `${what}: ${wide.length} chip(s) cannot take a third of the width`
  );
  return `${list.length} chips in ${chipRows(list).length} rows`;
};

check('the food chips come out three across', () =>
  everyChipFits([...ALLERGY.FOOD_ALLERGIES, ...ALLERGY.DIETARY_NEEDS], 'food and diet'));

check('the medicine and skin chips come out three across', () =>
  everyChipFits([...ALLERGY.OTHER_REACTIONS, ...ALLERGY.MEDICINE_REACTIONS], 'skin, air and medicines'));

check('the movement chips come out three across', () =>
  everyChipFits(MOVEMENT.MOVEMENT_RULES, 'movements'));

check('her follow-up chips come out three across', () =>
  everyChipFits(
    LIFE.MENOPAUSE_KINDS.filter((o) => !o.hint),
    'the menopause kinds'
  ));

// ----------------------------------------------------- the component obeys it

check('the component asks the rule rather than styling by eye', () => {
  assert.ok(/chipSpan\(option\)/.test(code), 'the component is not using chipSpan');
  assert.ok(/flexWrap: 'wrap'/.test(code), 'the list does not wrap, so there are no rows');
  return 'one rule, one component';
});

check('nothing shrinks and nothing clips', () => {
  // THE "WEE" RULE. Android measured an autosizing label in the system face and
  // drew it in Manrope, so every unselected tab lost exactly its last letter.
  for (const banned of ['adjustsFontSizeToFit', 'numberOfLines', 'ellipsizeMode']) {
    assert.ok(!new RegExp(banned).test(code), `the chips use ${banned} again`);
  }
  return 'a chip that cannot fit takes the row';
});

// ----------------------------------------------------------- it can fail

check('and this check can fail', () => {
  // A rule that gave every chip a third, which is the obvious implementation and
  // the one that truncates her longest answers.
  const naive = () => 'third';
  const long = { label: "I don't have periods for another reason" };
  assert.strictEqual(naive(long), 'third');
  assert.notStrictEqual(chipSpan(long), naive(long), 'the rule is the naive one');

  // And a list that claimed three across while carrying a hinted chip.
  const rows = chipRows([{ label: 'A', hint: 'h' }, { label: 'B' }, { label: 'C' }]);
  assert.notStrictEqual(rows[0].length, 3, 'a hinted chip is sharing its row');
  return 'the naive rule and a hinted chip are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
