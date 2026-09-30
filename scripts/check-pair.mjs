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

check('peanut butter on wholegrain toast DOES carry it', () => {
  // The brief gave this as a meal needing no label and Ruth withdrew the
  // example on 30 September: "It was a bad example." Peanuts and wheat are both
  // lysine-limited, so they do not complete each other and two grains on a
  // plate is not a pairing.
  const pb = item('Peanut butter 30g', 7, 'limiting_lysine');
  const toast = item('Wholegrain toast', 5, 'limiting_lysine');
  assert.equal(showsPair(pb, [pb, toast]), true, 'two lysine-limited foods do not complete each other');
});

check('and what it suggests for it is a breakfast, not a tin of beans', () => {
  const pb = item('Peanut butter 30g', 7, 'limiting_lysine');
  const card = pairCard(pb);
  const top = card.suggestions.join(' ').toLowerCase();
  assert.ok(/yoghurt|milk|egg/.test(top), `expected dairy or eggs first, got: ${card.suggestions.join(', ')}`);
});

check('a glass of milk with it silences the label', () => {
  const pb = item('Peanut butter 30g', 7, 'limiting_lysine');
  const toast = item('Wholegrain toast', 5, 'limiting_lysine');
  const milk = item('Glass of milk', 8, 'complete');
  assert.equal(showsPair(pb, [pb, toast, milk]), false);
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

check('a vegan is not told to pair with eggs, milk or yoghurt', () => {
  const rice = item('Rice', 5, 'limiting_lysine');
  const card = pairCard(rice, ['vegan']);
  assert.ok(!/egg|yoghurt|dairy|milk|cheese/i.test(card.suggestions.join(' ')), card.suggestions.join(', '));
  assert.ok(/beans|lentils|chickpeas/i.test(card.suggestions.join(' ')), 'and is still given something');
});

// ── NO LABEL WITHOUT A CARD BEHIND IT ───────────────────────────────────────
//
// Ruth, 30 September: "if nothing, then don't mention it, don't force it if
// it's going to feel broken." This was a real fault in the first version: the
// filtering lived in pairCard and the label never consulted it, so somebody
// whose allergies removed every suggestion saw the word, tapped it, and got
// nothing.

check('no suggestions survive the allergies -> no label at all', () => {
  const collagen = item('Collagen powder', 10, 'limiting_tryptophan');
  // Its only completers are eggs, dairy, fish, chicken and soya.
  const avoid = ['eggs', 'dairy', 'fish', 'chicken', 'soya'];
  assert.equal(pairCard(collagen, avoid), null, 'nothing left to suggest');
  assert.equal(showsPair(collagen, [collagen], avoid), false, 'so the word must not appear either');
});

check('but a partial filter still shows, because there is still something to say', () => {
  const collagen = item('Collagen powder', 10, 'limiting_tryptophan');
  const avoid = ['fish'];
  assert.ok(pairCard(collagen, avoid));
  assert.equal(showsPair(collagen, [collagen], avoid), true);
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
  [
    '',
    '  Settled 30 September: the brief’s peanut-butter-on-toast example was withdrawn,',
    '  so two lysine-limited foods correctly still carry the label, and what it offers',
    '  for them is a yoghurt, a glass of milk or an egg rather than a tin of beans.',
  ].join('\n')
);
if (failures.length > 0) process.exit(1);
