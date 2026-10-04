// DO TWO SWITCHES SAY EXACTLY WHAT THE FOUR INTENTS SAY?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-body-mode.mjs
//
// Ruth, 4 October 2026, after picking "Lose fat" AND "Less fat, more muscle" and
// finding no deficit and no pause control: "it might be the simplification we
// needed that was confusing the onboarding too... right now it's showing a set
// of options that actually were already decided should not be together."
//
// The goals screen offered eight chips, four of which were values of ONE question
// shown as four independent checkboxes - with the combination offered alongside
// its own parts. "Lose fat" + "Build muscle" stores precisely what "Less fat,
// more muscle" stores alone: three tap paths to one outcome.
//
// THE POINT OF THIS CHECK is that the replacement is a change of INTERFACE and
// not of arithmetic. If the two booleans are a bijection onto the four intents,
// nothing is migrated, nothing is recomputed, and every target, probe and parity
// check written against the focus columns still holds. If they are not, this is a
// rewrite of the calorie engine wearing a UI change's clothes, and it should be
// found here rather than in her targets.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { focusFromMode, modeFromFocus, modeLabel, modeExplanation, NO_MODE } = await import(
  root + '/mobile/src/lib/body-mode.ts'
);
const { BODY_INTENTS, intentFromFocus } = await import(root + '/mobile/src/lib/body-intent.ts');

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

const ALL = [
  { loseFat: false, buildMuscle: false },
  { loseFat: true, buildMuscle: false },
  { loseFat: false, buildMuscle: true },
  { loseFat: true, buildMuscle: true },
];

console.log('\n  TWO SWITCHES, THE SAME FOUR ANSWERS\n');

check('every combination is one of the four intents', () => {
  const found = ALL.map((mode) => {
    const { fat, muscle } = focusFromMode(mode);
    const intent = intentFromFocus(fat, muscle);
    assert.ok(intent, `${JSON.stringify(mode)} is not any intent the app knows`);
    return intent.key;
  });
  assert.strictEqual(new Set(found).size, 4, `four combinations produced ${new Set(found).size} intents`);
  return found.join(', ');
});

check('every intent is reachable by the switches', () => {
  // The other direction, and the one that matters for "nothing is lost": if an
  // intent cannot be expressed, retiring the chips removes an answer she had.
  const reachable = new Set(ALL.map((m) => intentFromFocus(...Object.values(focusFromMode(m))).key));
  for (const intent of BODY_INTENTS) {
    assert.ok(reachable.has(intent.key), `${intent.key} cannot be reached by any combination`);
  }
  return `${BODY_INTENTS.length} intents, all reachable`;
});

check('the round trip is lossless', () => {
  for (const mode of ALL) {
    const { fat, muscle } = focusFromMode(mode);
    assert.deepStrictEqual(modeFromFocus(fat, muscle), mode, `${JSON.stringify(mode)} did not survive`);
  }
  return '4 combinations, there and back';
});

check('an unanswered profile is not "both off"', () => {
  // A person who has never answered has no mode. Drawing two switches both
  // reading off would be the app answering for her - the silence-wearing-a-
  // choice's-clothes that asFocus was fixed for on 28 September.
  assert.strictEqual(modeFromFocus(null, null), null);
  assert.strictEqual(modeFromFocus('reduce', null), null);
  assert.strictEqual(modeFromFocus(null, 'increase'), null);
  assert.notDeepStrictEqual(modeFromFocus(null, null), NO_MODE);
  return 'null is not a pair of off switches';
});

check('both on is "Less fat, more muscle", which is what she picked', () => {
  // The exact confusion: those were two chips, and they are one state.
  const both = focusFromMode({ loseFat: true, buildMuscle: true });
  const chipWay = { fat: 'reduce', muscle: 'increase' };
  assert.deepStrictEqual(both, chipWay, 'the switches and the old chip disagree');
  assert.strictEqual(modeLabel({ loseFat: true, buildMuscle: true }), 'Less fat, more muscle');
  return 'same stored state, one visible answer';
});

check('every state is named and explained, in its own words', () => {
  const labels = new Set();
  const notes = new Set();
  for (const mode of ALL) {
    const label = modeLabel(mode);
    const note = modeExplanation(mode);
    assert.ok(label.length > 0, `${JSON.stringify(mode)} has no name`);
    assert.ok(note.length > 40, `${JSON.stringify(mode)} has no real explanation`);
    labels.add(label);
    notes.add(note);
  }
  assert.strictEqual(labels.size, 4, 'two states share a name');
  // BOTH ON MUST NOT READ AS THE TWO EXPLANATIONS STACKED. As independent
  // switches it would imply a deficit AND a surplus, which is incoherent.
  assert.strictEqual(notes.size, 4, 'two states share an explanation');
  const both = modeExplanation({ loseFat: true, buildMuscle: true });
  assert.ok(/not under it/.test(both), 'both-on does not say it is NOT a deficit');
  assert.ok(!/drops below/.test(both), 'both-on still describes a deficit');
  return '4 names, 4 explanations, none borrowed';
});

check('the unset state says there is no target, not that it is maintenance', () => {
  const note = modeExplanation(null);
  assert.ok(/no calorie target/.test(note), `unset reads as "${note}"`);
  assert.notStrictEqual(note, modeExplanation(NO_MODE), 'unset and "steady" say the same thing');
  return 'nothing set is not the same as holding steady';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
