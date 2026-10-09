// THE SYMPTOM LIST IS THE DESIGN DECISION, NOT THE LAYOUT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-symptom-vocabulary.mjs
//
// Ruth, 9 October 2026, on a draft picker with a group headed "the forty-plus
// ones": "'the forty+ ones' is not quite the right language....it feels off."
//
// She was right twice over. The labelling made symptoms a consequence of her
// age - THIS IS WHAT YOU ARE NOW, against a brand line saying her body is not
// a problem to solve. And underneath the labelling was the real fault: the app
// for women over 40 did not contain a single one of the symptoms that tell a
// 44-year-old what is happening to her. Twelve entries written for a standard
// tracker: cramps, acne, cravings, mood.
//
// This check is mostly a list, and that is the point. The list IS the feature.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { SYMPTOM_GROUPS, COMMON_SYMPTOMS, symptomChoices } = await import(
  root + '/mobile/src/lib/cycle-day.ts'
);

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

const all = COMMON_SYMPTOMS.map((s) => s.toLowerCase());
const has = (s) => all.includes(s.toLowerCase());

console.log('\n  THE SYMPTOM LIST IS THE DESIGN DECISION\n');

check('the ones a perimenopausal user needs are all there', () => {
  // NONE of these were in the list before today, in an app whose whole
  // audience is women over 40.
  const needed = [
    'Hot flush',
    'Night sweats',
    'Broken sleep',
    'Brain fog',
    'Heavier than usual',
    'Joint aches',
  ];
  const missing = needed.filter((s) => !has(s));
  assert.deepStrictEqual(missing, [], `missing: ${missing.join(', ')}`);
  return `${needed.length} added, none of which existed before`;
});

check('and this check can fail', () => {
  // The assertion above is that a list contains things, which passes on a list
  // containing everything. So prove absence is detected, and that the list has
  // not simply become enormous.
  assert.strictEqual(has('Sore elbow'), false, 'the list contains something it should not');
  assert.ok(COMMON_SYMPTOMS.length <= 32, `${COMMON_SYMPTOMS.length} chips is a wall, not a picker`);
  assert.ok(COMMON_SYMPTOMS.length >= 20, `only ${COMMON_SYMPTOMS.length} chips`);
  return `${COMMON_SYMPTOMS.length} chips, and an absent one reads as absent`;
});

check('no group is named after how old she is', () => {
  // The whole correction. A group headed by an age bracket says the symptoms
  // belong to a decline rather than to a body.
  for (const g of SYMPTOM_GROUPS) {
    assert.ok(
      !/\b(40|forty|45|50|older|age|peri|menopaus)/i.test(g.name),
      `group named after an age or a life stage: "${g.name}"`
    );
  }
  return SYMPTOM_GROUPS.map((g) => g.name).join(' · ');
});

check('the groups say what the symptom is', () => {
  const names = SYMPTOM_GROUPS.map((g) => g.name);
  assert.deepStrictEqual(names, [
    'Body',
    'Bleeding',
    'Sleep and temperature',
    'Head and mood',
  ]);
  // And every one has enough in it to be worth a heading.
  for (const g of SYMPTOM_GROUPS) {
    assert.ok(g.items.length >= 4, `"${g.name}" has only ${g.items.length}`);
  }
  return '4 groups, each with at least 4';
});

check('the flat list is derived, so the two cannot disagree', () => {
  const flat = SYMPTOM_GROUPS.flatMap((g) => g.items);
  assert.deepStrictEqual(COMMON_SYMPTOMS, flat);
  // Nothing appears in two groups.
  assert.strictEqual(new Set(all).size, all.length, 'a symptom is in two groups');
  return 'one source, no duplicates';
});

check('the mood three survived, because they are not the Feeling screen', () => {
  // They came off once and went back the same evening. A mood RATING is where
  // a day sat between Low and Bright; irritability is a symptom somebody had,
  // and a person can have a perfectly good day and be irritable in it.
  for (const s of ['Low mood', 'Anxiety', 'Irritability']) {
    assert.ok(has(s), `${s} has been removed again`);
  }
  return 'low mood, anxiety, irritability';
});

check('her own words still beat the chips', () => {
  // The picker is a shortcut, never the vocabulary. A chip she has to squeeze
  // herself into is the thing this app exists not to be.
  const withHers = symptomChoices(['that dragging feeling low down']);
  assert.ok(
    withHers.some((s) => s === 'that dragging feeling low down'),
    'something she typed herself was dropped from the choices'
  );
  assert.ok(withHers.length > COMMON_SYMPTOMS.length, 'hers was not added');
  // And case-duplicates of a chip do not double up.
  const dupe = symptomChoices(['cramps']);
  const cramps = dupe.filter((s) => s.toLowerCase() === 'cramps');
  assert.strictEqual(cramps.length, 1, 'Cramps and cramps both offered');
  return 'hers kept, duplicates merged';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
