// WHAT SHE IS TAKING IS NOT WHERE SHE IS.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-hormone-use.mjs
//
// Ruth's Body Manual draft, 30 September 2026, listed hormonal contraception
// and HRT among the life stages as mutually exclusive radio options. They are
// interventions, they combine with a stage, and perimenopausal AND on HRT is
// the ordinary case in this audience.
//
// The gap it exposed is the reason this file exists rather than a note. The app
// has asked about HRT since the spine was rebuilt, for a stated reason: "so a
// monthly bleed on sequential HRT is not read as a cycle." Nothing has ever
// asked about CONTRACEPTION, and a withdrawal bleed on the combined pill is not
// a natural cycle either - so a woman on the pill answers "regular periods",
// truthfully as she experiences it, and every bleed is read as evidence of a
// cycle the app can reason from.

import assert from 'node:assert';

import {
  HORMONE_USE_OPTIONS,
  bleedMayNotBeACycle,
  hrtFromHormoneUse,
  onContraception,
  toggleHormoneUse,
} from '../mobile/src/lib/life-stage.ts';

let pass = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

check('the answers combine, because bodies do', () => {
  const after = toggleHormoneUse(['hormonal_contraception'], 'hrt');
  assert.deepEqual(after.sort(), ['hormonal_contraception', 'hrt']);
});

check('"neither" clears everything, because it answers the whole question', () => {
  assert.deepEqual(toggleHormoneUse(['hrt', 'hormonal_contraception'], 'neither'), ['neither']);
});

check('and choosing something after "neither" drops it', () => {
  assert.deepEqual(toggleHormoneUse(['neither'], 'hrt'), ['hrt']);
});

check('"prefer not to say" behaves the same way', () => {
  assert.deepEqual(toggleHormoneUse(['hrt'], 'prefer_not_to_say'), ['prefer_not_to_say']);
  assert.deepEqual(toggleHormoneUse(['prefer_not_to_say'], 'hormonal_contraception'), [
    'hormonal_contraception',
  ]);
});

check('tapping the same answer again unticks it', () => {
  assert.deepEqual(toggleHormoneUse(['hrt'], 'hrt'), []);
});

// ── THE OLD COLUMN KEEPS WORKING ────────────────────────────────────────────
//
// `hrt` is read by life-stage-facts.ts and by anything written before today.
// Nothing may be migrated in a hurry at ten at night.

check('hrt is derived, so the readers that predate this still work', () => {
  assert.equal(hrtFromHormoneUse(['hrt']), 'yes');
  assert.equal(hrtFromHormoneUse(['hormonal_contraception', 'hrt']), 'yes');
  assert.equal(hrtFromHormoneUse(['hormonal_contraception']), 'no');
  assert.equal(hrtFromHormoneUse(['neither']), 'no');
  assert.equal(hrtFromHormoneUse(['prefer_not_to_say']), 'prefer_not_to_say');
});

check('and an unanswered question stays unanswered, not "no"', () => {
  assert.equal(hrtFromHormoneUse([]), null, 'null means she was never asked');
});

// ── THE THING THE QUESTION IS ACTUALLY FOR ──────────────────────────────────

check('a bleed on HRT may not be a cycle', () => {
  assert.equal(bleedMayNotBeACycle(['hrt']), true);
});

check('AND NEITHER IS ONE ON THE PILL, which nothing has ever asked', () => {
  assert.equal(
    bleedMayNotBeACycle(['hormonal_contraception']),
    true,
    'a withdrawal bleed is not a natural cycle, and this is the gap the question closes'
  );
});

check('a woman on neither is reasoned about normally', () => {
  assert.equal(bleedMayNotBeACycle(['neither']), false);
  assert.equal(bleedMayNotBeACycle([]), false, 'never asked is not the same as answered');
});

check('the options say what they mean in her words', () => {
  // HER FOUR, 5 OCTOBER 2026: "HRT · The pill · Coil · None". The single
  // "Hormonal contraception" chip is gone, because nobody says that. This case
  // used to look that key up by name and read its hint - so it broke the moment
  // the chip it was pinned to stopped existing, which is the right behaviour for
  // a check and the wrong shape for one. It now asserts the property: between
  // them, the offered chips name the things she would actually say.
  const offered = HORMONE_USE_OPTIONS.map((o) => `${o.label} ${o.hint ?? ''}`).join(' ');
  for (const thing of ['pill', 'coil', 'implant', 'injection']) {
    assert.ok(new RegExp(thing, 'i').test(offered), `nothing on the screen names the ${thing}`);
  }
  assert.ok(/HRT/.test(offered), 'HRT is not offered');

  // A COPPER COIL IS NOT HORMONAL, and a chip reading "Coil" would record a
  // hormone that is not there. The word never appears without it being said.
  for (const option of HORMONE_USE_OPTIONS) {
    if (!/coil/i.test(option.label)) continue;
    assert.ok(
      /hormonal/i.test(option.label),
      `"${option.label}" would catch a copper coil, which is not hormonal`
    );
  }

  // AND SAYING NOTHING IS STILL AN ANSWER, on the most personal screen in setup.
  assert.ok(
    HORMONE_USE_OPTIONS.some((o) => o.key === 'prefer_not_to_say'),
    'prefer not to say is gone from the question it exists for'
  );
  assert.ok(
    HORMONE_USE_OPTIONS.some((o) => o.key === 'neither'),
    'there is no way to say none of these'
  );
});

check('the old stored value still counts as contraception', () => {
  // A PHONE ON YESTERDAY'S BUNDLE WRITES IT, and the answer it recorded has not
  // changed meaning. This is the case that would have gone silently false: the
  // split of one value into two does not fail anywhere, it just stops being true
  // for everybody on the pill.
  assert.ok(onContraception(['hormonal_contraception']), 'an older answer stopped counting');
  assert.ok(onContraception(['the_pill']), 'the pill does not count');
  assert.ok(onContraception(['hormonal_coil']), 'a hormonal coil does not count');
  assert.ok(!onContraception(['hrt']), 'HRT is being counted as contraception');
  assert.ok(!onContraception(['neither']), 'none is being counted as contraception');
  // AND THE RULE THE WHOLE QUESTION BUYS, through the same list.
  assert.ok(bleedMayNotBeACycle(['the_pill']), 'a withdrawal bleed on the pill reads as a cycle');
});

// ── MUTATION ────────────────────────────────────────────────────────────────
//
// The draft's own design: one exclusive list. If that passes these checks they
// are not testing the thing this file was written for.

let exclusiveCaught = false;
try {
  const radio = (_current, key) => [key];
  assert.deepEqual(radio(['hormonal_contraception'], 'hrt').sort(), [
    'hormonal_contraception',
    'hrt',
  ]);
} catch {
  exclusiveCaught = true;
}

let pillCaught = false;
try {
  const hrtOnly = (use) => use.includes('hrt');
  assert.equal(hrtOnly(['hormonal_contraception']), true);
} catch {
  pillCaught = true;
}

if (!exclusiveCaught) failures.push('USELESS: a mutually exclusive list passed the combining checks');
if (!pillCaught) failures.push('USELESS: an HRT-only rule passed the withdrawal-bleed check');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(
  `  Proof: a radio-button list is caught = ${exclusiveCaught}, an HRT-only rule is caught = ${pillCaught}`
);
if (failures.length > 0) process.exit(1);
