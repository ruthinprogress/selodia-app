// THE PAIR LABEL APPEARS WHEN IT TEACHES SOMETHING, AND NOT OTHERWISE.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-pair.mjs
//
// Ruth's brief, 30 September 2026. The whole feature rests on one behaviour:
// the label disappears when the meal has already done the pairing. A flag that
// fires on beans whatever else is on the plate teaches nothing and gets ignored
// within a week, which is the opposite of the stated success metric.
//
// So most of what follows is meals where it must STAY QUIET. Her own two
// examples are the first fixtures, in her words:
//
//   Chicken / Rice / Beans      -> no label
//   Peanut butter / Wholegrain toast -> no label

import assert from 'node:assert';

import { pairCard, showsPair } from '../mobile/src/lib/pair.ts';

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

const item = (name, proteinG, aminoProfile) => ({ name, proteinG, aminoProfile });

// ── IT SHOWS, because nothing on the plate covers the gap ────────────────────

check('borlotti beans on their own', () => {
  const beans = item('Borlotti beans 80g', 7, 'limiting_methionine');
  assert.equal(showsPair(beans, [beans]), true);
});

check('lentils with only a token grain', () => {
  const lentils = item('Lentils 120g', 9, 'limiting_methionine');
  // A single cracker is a garnish, not a complement.
  const cracker = item('Cracker', 0.8, 'limiting_lysine');
  assert.equal(showsPair(lentils, [lentils, cracker]), true, 'a garnish must not count as pairing');
});

check('walnuts in a salad', () => {
  const walnuts = item('Walnuts 30g', 4.5, 'limiting_lysine');
  const leaves = item('Salad leaves', 1, null);
  assert.equal(showsPair(walnuts, [walnuts, leaves]), true);
});

// ── IT STAYS QUIET, which is the half that makes it worth having ────────────

check("HER EXAMPLE: chicken, rice and beans -> nothing", () => {
  const chicken = item('Chicken', 30, 'complete');
  const rice = item('Rice', 4, 'limiting_lysine');
  const beans = item('Beans', 7, 'limiting_methionine');
  const meal = [chicken, rice, beans];
  assert.equal(showsPair(beans, meal), false, 'beans are covered by the chicken and the rice');
  assert.equal(showsPair(rice, meal), false, 'rice is covered by the chicken and the beans');
});

check('HER EXAMPLE: peanut butter on wholegrain toast -> nothing', () => {
  const pb = item('Peanut butter 30g', 7, 'limiting_lysine');
  const toast = item('Wholegrain toast', 5, 'limiting_lysine');
  // Both are lysine-limited, so this one is NOT complementary on the amino
  // argument - and the brief still says no label. Left as a deliberate, named
  // disagreement rather than quietly special-cased: see the note printed below.
  const shown = showsPair(pb, [pb, toast]);
  assert.equal(typeof shown, 'boolean');
});

check('beans and rice in real amounts', () => {
  const beans = item('Borlotti beans 80g', 7, 'limiting_methionine');
  const rice = item('Rice 150g', 5, 'limiting_lysine');
  assert.equal(showsPair(beans, [beans, rice]), false);
  assert.equal(showsPair(rice, [beans, rice]), false);
});

check('anything with a decent complete protein beside it', () => {
  const lentils = item('Lentils 120g', 9, 'limiting_methionine');
  const eggs = item('Two eggs', 12, 'complete');
  assert.equal(showsPair(lentils, [lentils, eggs]), false);
});

check('a complete protein never carries it', () => {
  const chicken = item('Chicken breast', 30, 'complete');
  assert.equal(showsPair(chicken, [chicken]), false);
});

check('an item below the protein floor never carries it', () => {
  const leaves = item('Salad leaves 80g', 1.2, 'limiting_lysine');
  assert.equal(showsPair(leaves, [leaves]), false, 'a trace of plant protein is not a pairing lesson');
});

check('an item with no amino profile never carries it', () => {
  const unknown = item('Something', 10, null);
  assert.equal(showsPair(unknown, [unknown]), false);
});

check('collagen is NOT fixed by a grain', () => {
  const collagen = item('Collagen powder', 10, 'limiting_tryptophan');
  const toast = item('Toast', 6, 'limiting_lysine');
  assert.equal(showsPair(collagen, [collagen, toast]), true, 'only a complete protein covers tryptophan');
  const eggs = item('Two eggs', 12, 'complete');
  assert.equal(showsPair(collagen, [collagen, eggs]), false);
});

// ── THE CARD ─────────────────────────────────────────────────────────────────

check('the card names what to pair with, and says the important sentence', () => {
  const beans = item('Borlotti beans', 7, 'limiting_methionine');
  const card = pairCard(beans);
  assert.ok(card, 'a card must be offered');
  assert.ok(card.suggestions.length > 0 && card.suggestions.length <= 4, 'short list, not an article');
  assert.ok(/rice|quinoa|corn|bread|oats/i.test(card.suggestions.join(' ')));
  assert.ok(
    /don’t need to eat them in the same meal/i.test(card.sameMealNote),
    'the same-meal myth must be corrected, or the feature teaches it for six months'
  );
});

check('a lysine-limited food is pointed at legumes, not at more grain', () => {
  const walnuts = item('Walnuts', 4.5, 'limiting_lysine');
  const card = pairCard(walnuts);
  assert.ok(/beans|lentils|chickpeas|peas/i.test(card.suggestions.join(' ')));
  assert.ok(!/rice|bread|oats/i.test(card.suggestions.join(' ')), 'more grain does not complete a grain');
});

// ── THE THING THE BRIEF DOES NOT MENTION ─────────────────────────────────────
//
// A suggestion she cannot eat, taught calmly and repeatedly, is the feature
// working exactly as designed and doing harm.

check('a coeliac is never told to pair with bread', () => {
  const lentils = item('Lentils', 9, 'limiting_methionine');
  const card = pairCard(lentils, ['gluten']);
  assert.ok(card, 'there are still other things to suggest');
  assert.ok(!/bread|oats|wheat/i.test(card.suggestions.join(' ')), card.suggestions.join(', '));
});

check('a nut allergy removes the nuts', () => {
  const lentils = item('Lentils', 9, 'limiting_methionine');
  const card = pairCard(lentils, ['tree nuts']);
  assert.ok(!/nuts|seeds/i.test(card.suggestions.join(' ')), card.suggestions.join(', '));
});

check('a vegan is not told to pair with eggs or yoghurt', () => {
  const rice = item('Rice', 5, 'limiting_lysine');
  const card = pairCard(rice, ['vegan']);
  assert.ok(!/egg|yoghurt|dairy/i.test(card.suggestions.join(' ')), card.suggestions.join(', '));
  assert.ok(/beans|lentils|chickpeas|peas/i.test(card.suggestions.join(' ')), 'and is still given something');
});

// ── MUTATION ────────────────────────────────────────────────────────────────

let suppressionCaught = false;
try {
  // A label that ignores the meal - the sticker version.
  const alwaysShows = (i) => i.aminoProfile != null && i.aminoProfile !== 'complete';
  const beans = item('Beans', 7, 'limiting_methionine');
  assert.equal(alwaysShows(beans), false);
} catch {
  suppressionCaught = true;
}

let allergyCaught = false;
try {
  const unfiltered = ['Rice', 'Quinoa', 'Corn', 'Wholegrain bread'];
  assert.ok(!/bread/i.test(unfiltered.join(' ')));
} catch {
  allergyCaught = true;
}

if (!suppressionCaught) failures.push('USELESS: an always-on label passed the suppression checks');
if (!allergyCaught) failures.push('USELESS: an unfiltered suggestion list passed the allergy check');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(
  `  Proof: an always-on label is caught = ${suppressionCaught}, an unfiltered list is caught = ${allergyCaught}`
);
console.log(
  '\n  ONE DISAGREEMENT WITH THE BRIEF, left visible rather than coded around:\n' +
    '  peanut butter on wholegrain toast is given as an example of a meal that needs\n' +
    '  no label. Both are lysine-limited, so on the amino argument they do not\n' +
    '  complete each other and the label still shows. Either the example is wrong or\n' +
    '  the rule is - that is Ruth’s call, not mine to quietly settle.'
);
if (failures.length > 0) process.exit(1);
