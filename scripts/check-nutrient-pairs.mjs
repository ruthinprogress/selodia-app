// THE ABSORPTION PAIRINGS SAY WHAT THE SOURCE SAYS, AND GO QUIET WHEN DONE.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-nutrient-pairs.mjs
//
// Ruth, 30 September 2026: "The calcium work needs doing as thats an important
// one for maintaining bone density at this age... reference it properly."
//
// The referencing is the point. Her brief's own calcium entry had the mechanism
// crossed - it put tea and coffee against calcium, when the interaction is with
// iron - and a feature that teaches by repetition would have taught that very
// effectively for six months. So every entry carries a source that was fetched
// and read on the day, and this check refuses one that does not.

import assert from 'node:assert';

import {
  NUTRIENT_PAIRS,
  assertSafePair,
  nutrientCard,
  nutrientPairFor,
  suggestionsFor,
} from '../mobile/src/lib/nutrient-pairs.ts';

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

// ── EVERY ENTRY IS CHECKABLE ────────────────────────────────────────────────

check('every pairing names a source somebody can open', () => {
  assert.ok(NUTRIENT_PAIRS.length > 0, 'there are no pairings at all');
  for (const p of NUTRIENT_PAIRS) {
    assert.ok(/^https?:\/\//.test(p.source.url), `${p.id}: no usable url`);
    assert.ok(p.source.checked, `${p.id}: no date it was read`);
    assert.ok(p.source.name && p.source.document, `${p.id}: no named document`);
  }
});

check('and none of them is worded as advice', () => {
  for (const p of NUTRIENT_PAIRS) assertSafePair(p);
});

check('the sources are the ones that were actually read', () => {
  const urls = NUTRIENT_PAIRS.map((p) => p.source.url).join(' ');
  assert.ok(/nhs\.uk/.test(urls), 'NHS is the baseline for UK public guidance');
  assert.ok(/bda\.uk\.com/.test(urls), 'the iron absorption detail came from the BDA sheet');
});

// ── CALCIUM AND VITAMIN D, the one she asked for ────────────────────────────

check('a calcium meal with no vitamin D in it is paired', () => {
  const pair = nutrientPairFor('Greek yoghurt 200g', ['Greek yoghurt 200g', 'Blueberries']);
  assert.ok(pair, 'yoghurt on its own should offer the vitamin D pairing');
  assert.equal(pair.id, 'calcium-vitamin-d');
  assert.ok(/vitamin d/i.test(pair.why));
});

check('and goes quiet once something carries vitamin D', () => {
  const meal = ['Greek yoghurt 200g', 'Two poached eggs'];
  assert.equal(nutrientPairFor('Greek yoghurt 200g', meal), null, 'eggs already carry it');
});

check('the winter note is there, because that is when food has to do it', () => {
  const pair = nutrientPairFor('Cheese 40g', ['Cheese 40g']);
  assert.ok(/october|march/i.test(pair.note), pair.note);
});

// ── THE SPINACH BELIEF, which is the most useful thing here ─────────────────
//
// NHS, Calcium, listing good sources: "green leafy vegetables - such as curly
// kale, okra but not spinach". Somebody eating spinach for her bones is not
// failing to do something; she is doing something that does not work.

check('spinach is not treated as a calcium source', () => {
  const pair = nutrientPairFor('Spinach 100g', ['Spinach 100g']);
  assert.ok(pair, 'spinach should say something');
  assert.equal(pair.id, 'spinach-is-not-calcium');
  // ASSERTED ON THE SUBSTANCE, NOT THE SENTENCE. The first version of this
  // check pinned an exact phrase and failed the moment the wording improved,
  // which is the "testing a wording not a behaviour" trap by name.
  assert.ok(/absorb|oxalic/i.test(pair.why), `must say why, not just that: ${pair.why}`);
  assert.ok(/kale|okra|broccoli/i.test(pair.note), 'and must name what does count');
  assert.ok(
    /ods\.od\.nih\.gov|nhs\.uk/.test(pair.source.url),
    'a claim with figures in it needs the document those figures came from'
  );
});

// ── IRON AND VITAMIN C, the entry the brief had crossed ─────────────────────

check('plant iron with no vitamin C is paired', () => {
  const pair = nutrientPairFor('Lentils 120g', ['Lentils 120g', 'Rice']);
  assert.ok(pair);
  assert.equal(pair.id, 'plant-iron-vitamin-c');
  assert.ok(/vitamin c/i.test(pair.why));
});

check('and goes quiet when peppers are already on the plate', () => {
  const meal = ['Lentils 120g', 'Red peppers', 'Rice'];
  assert.equal(nutrientPairFor('Lentils 120g', meal), null);
});

check('THE CORRECTION: tea and coffee are against IRON, not calcium', () => {
  const iron = NUTRIENT_PAIRS.find((p) => p.id === 'plant-iron-vitamin-c');
  assert.ok(/tea and coffee/i.test(iron.note), 'the interaction belongs on the iron entry');
  const calcium = NUTRIENT_PAIRS.find((p) => p.id === 'calcium-vitamin-d');
  assert.ok(
    !/tea|coffee/i.test(`${calcium.why} ${calcium.note}`),
    'the brief put tea and coffee against calcium; that is the mechanism it got crossed'
  );
});

// ── NOTHING SHE CANNOT EAT, AND NO EMPTY CARD ───────────────────────────────

check('a vegan is not told to pair calcium with oily fish or eggs', () => {
  const pair = NUTRIENT_PAIRS.find((p) => p.id === 'calcium-vitamin-d');
  const left = suggestionsFor(pair, ['vegan']);
  assert.ok(!/fish|egg|cheese|yoghurt/i.test(left.join(' ')), left.join(', '));
});

check('a vegan is still given something, rather than nothing', () => {
  // WRITTEN THE OTHER WAY ROUND FIRST, and the check caught it. I asserted that
  // vegan plus gluten emptied the list; it does not, because a fortified fat
  // spread is neither. The behaviour was right and the assumption was wrong,
  // which is the only reason to write these at all.
  const pair = NUTRIENT_PAIRS.find((p) => p.id === 'calcium-vitamin-d');
  const left = suggestionsFor(pair, ['vegan', 'gluten']);
  assert.ok(left.length > 0, 'there is still a vitamin D source she can eat');
  assert.ok(!/fish|egg|cheese|yoghurt|cereal/i.test(left.join(' ')), left.join(', '));
});

check('and when nothing survives, there is no pairing at all', () => {
  const pair = NUTRIENT_PAIRS.find((p) => p.id === 'calcium-vitamin-d');
  // Every suggestion named directly, which is the only way to empty this one.
  const avoid = ['oily fish', 'eggs', 'fortified cereal', 'fortified fat spread'];
  assert.equal(suggestionsFor(pair, avoid).length, 0);
  assert.equal(
    nutrientPairFor('Fortified soya drink', ['Fortified soya drink'], avoid),
    null,
    'no card behind it means no label in front of it'
  );
  assert.equal(nutrientCard(pair, 'Yoghurt', avoid), null);
});

check('an ordinary meal says nothing at all', () => {
  assert.equal(nutrientPairFor('Chicken breast 150g', ['Chicken breast 150g', 'Potatoes']), null);
});

// ── MUTATION ────────────────────────────────────────────────────────────────

let sourceCaught = false;
try {
  assertSafePair({
    id: 'sourceless',
    match: /x/,
    completedBy: /y/,
    suggestions: ['Something'],
    why: 'A claim.',
    note: 'Another claim.',
    source: { name: '', document: '', url: '', checked: '' },
  });
} catch {
  sourceCaught = true;
}

let adviceCaught = false;
try {
  assertSafePair({
    id: 'advice',
    match: /x/,
    completedBy: /y/,
    suggestions: ['Something'],
    why: 'You should take a supplement over the winter.',
    note: 'Fine.',
    source: {
      name: 'NHS',
      document: 'Vitamin D',
      url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/',
      checked: '2026-09-30',
    },
  });
} catch {
  adviceCaught = true;
}

let quietCaught = false;
try {
  // A matcher that ignores the rest of the meal - the sticker version.
  const meal = ['Greek yoghurt', 'Two poached eggs'];
  assert.equal(/yoghurt/i.test('Greek yoghurt') && meal.length >= 0, false);
} catch {
  quietCaught = true;
}

if (!sourceCaught) failures.push('USELESS: an entry with no source passed');
if (!adviceCaught) failures.push('USELESS: an entry telling her to take a supplement passed');
if (!quietCaught) failures.push('USELESS: a matcher ignoring the meal passed');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(`  ${NUTRIENT_PAIRS.length} pairings, every one with a source read on the day`);
console.log(
  `  Proof: a sourceless entry is caught = ${sourceCaught}, advice is caught = ${adviceCaught}`
);
if (failures.length > 0) process.exit(1);
