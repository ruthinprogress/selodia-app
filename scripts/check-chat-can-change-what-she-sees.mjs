// SHE ASKED THE APP TO DO A THING THE APP KNEW HOW TO DO.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-chat-can-change-what-she-sees.mjs
//
// Ruth to the chat, 21 October 2026: "I want to track my calcium and iron
// intake." The chat read what she tracks - that much was built in October,
// after being wrong about it four times - and had no way to CHANGE it. So it
// answered with directions:
//
//   1. Tap the three dots at the top right of any tab
//   2. Open What I track
//   3. Switch on calcium and iron
//
// The next morning she reported it as a bug: "Iron and calcium not showing on
// food logs." Which is fair. From where she stood she had asked, and nothing
// happened - and a request the app understood and did not act on looks exactly
// like one it got wrong.
//
// WHAT THIS GUARDS, and only the first is about the feature:
//
//   THE CHAT CAN SET IT. One field, applied at the write, like every other
//   action this app takes.
//
//   IT CANNOT SWITCH OFF CALORIES OR PROTEIN, and not because it is asked
//   nicely not to. The list it works from holds the optional macros only, so no
//   name the model could send reaches them.
//
//   IT NEVER CLAIMS A CHANGE IT DID NOT MAKE. Asking for calcium when calcium
//   is already on is ordinary - she did exactly that, having been told the day
//   before that it was unavailable - and "I've switched it on" when it was
//   already on teaches her that this app's confirmations mean nothing.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { macroChange, macroChangeNote, readMacroNames, TRACKABLE } = await import(
  here('app/lib/track-macros-request.ts')
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

const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
const HERS = ['fat', 'saturated', 'carbs', 'sugar', 'fibre', 'salt'];

console.log('\n  THE CHAT CAN CHANGE WHAT SHE SEES\n');

check('HER OWN SENTENCE SWITCHES THEM ON', () => {
  const c = macroChange(HERS, ['calcium', 'iron']);
  assert.deepStrictEqual(c.added, ['calcium', 'iron'], c.added.join(', '));
  assert.ok(c.next, 'nothing would be written');
  assert.ok(c.next.includes('calcium') && c.next.includes('iron'), c.next.join(', '));
  // And nothing she already had is lost on the way.
  for (const k of HERS) assert.ok(c.next.includes(k), `${k} was dropped`);
  const note = macroChangeNote(c, 'saved');
  assert.ok(/calcium and iron/.test(note), note);
  return 'calcium and iron, and the six she had';
});

check('AND HER WORDS DO NOT HAVE TO BE THE COLUMN NAMES', () => {
  assert.deepStrictEqual(readMacroNames(['sat fat']).keys, ['saturated']);
  assert.deepStrictEqual(readMacroNames(['saturated fat']).keys, ['saturated']);
  assert.deepStrictEqual(readMacroNames(['carbohydrates']).keys, ['carbs']);
  // Nobody asks for sodium. They ask for salt.
  assert.deepStrictEqual(readMacroNames(['sodium']).keys, ['salt']);
  assert.deepStrictEqual(readMacroNames(['fiber']).keys, ['fibre']);
  return 'sat fat, carbohydrates, sodium, fiber';
});

check('CALORIES AND PROTEIN CANNOT BE SWITCHED OFF', () => {
  // Structural, not a rule anybody has to obey: they are not in the list the
  // chat works from, so no name reaches them.
  assert.ok(!TRACKABLE.includes('kcal'), 'calories are switchable');
  assert.ok(!TRACKABLE.includes('protein'), 'protein is switchable');
  const c = macroChange(HERS, [], ['protein', 'calories']);
  assert.deepStrictEqual(c.removed, [], `it switched off ${c.removed.join(', ')}`);
  assert.strictEqual(c.next, null, 'a write was made for a change it cannot make');
  // And it says which words it could not use, rather than ignoring them.
  assert.ok(c.unknown.length === 2, c.unknown.join(', '));
  return 'no name reaches them';
});

check('ALREADY ON IS NOT A CHANGE', () => {
  // She asked for calcium the day after being told it was unavailable. A reply
  // confirming work nobody did is worse than no reply.
  const c = macroChange([...HERS, 'calcium'], ['calcium']);
  assert.deepStrictEqual(c.added, [], 'it counted an existing macro as added');
  assert.strictEqual(c.next, null, 'it wrote a row for a change of nothing');
  const note = macroChangeNote(c, 'nothing');
  assert.ok(/ALREADY/.test(note), note);
  assert.ok(!/switched on/i.test(note), `it claims work that did not happen: ${note}`);
  return 'it says it is already there';
});

check('A NUTRIENT THE APP DOES NOT KEEP IS NAMED, NOT GUESSED', () => {
  const c = macroChange(HERS, ['vitamin d', 'iron']);
  assert.deepStrictEqual(c.unknown, ['vitamin d'], c.unknown.join(', '));
  assert.deepStrictEqual(c.added, ['iron'], 'the half it could do was dropped too');
  const note = macroChangeNote(c, 'saved');
  assert.ok(/vitamin d/.test(note), 'the word she used is not named back to her');
  assert.ok(/iron/.test(note), 'the part that worked is not reported');
  return 'iron on, vitamin D named';
});

check('AND A FAILED WRITE IS NEVER REPORTED AS DONE', () => {
  const c = macroChange(HERS, ['iron']);
  const note = macroChangeNote(c, 'failed');
  assert.ok(/FAILED to save/.test(note), note);
  assert.ok(/Do not say it is done/.test(note), 'nothing stops the reply claiming it');
  assert.ok(!/now shows/.test(note), `it describes the change anyway: ${note}`);
  return 'the reply is told not to claim it';
});

check('THE TURN ACTUALLY WIRES ALL THIS UP', () => {
  // The wire, not the arithmetic - the fault that produced this feature was a
  // perfect reader with no writer behind it.
  assert.ok(/startTrackingMacros/.test(route), 'the chat has no field for it');
  assert.ok(/stopTrackingMacros/.test(route), 'it can switch on and never off');
  assert.ok(/macroChange\(/.test(route), 'the field is read and never applied');
  assert.ok(/tracked_macros: change\.next/.test(route), 'the change is never written');
  // AND THE OUTCOME REACHES THE REPLY, which is the half that was missing from
  // the diary and the reminder until 20 October.
  const at = route.indexOf('calendarNote(calendarResult)');
  const block = route.slice(at, at + 400);
  assert.ok(/macroNote/.test(block), 'the reply is not told what happened');
  return 'field, write, and the note';
});

check('AND THE TICK BOX DOES NOT CLAIM A SAVE EITHER', () => {
  // The other half of the same morning's bug, and the older of the two.
  // saveTrackedMacros was written to return false "so a caller can say so
  // rather than assume", and this caller awaited the promise and threw the
  // answer away.
  //
  // From the outside: the tick appears, because the tick is optimistic;
  // nothing says otherwise; and the only way she finds out is noticing, days
  // later, that the column never arrived. Which is how this was reported.
  const ui = fs.readFileSync('mobile/src/components/macro-choices.tsx', 'utf8');
  assert.ok(/const saved = await saveTrackedMacros\(next\)/.test(ui), 'the save result is still discarded');
  assert.ok(/if \(!saved\)/.test(ui), 'a failed save changes nothing on screen');
  // The tick goes back where it was, so the screen and the database agree.
  assert.ok(/setChosen\(before\)/.test(ui), 'a failed save leaves the wrong tick showing');
  assert.ok(/That did not save/.test(ui), 'a failed save is silent');
  return 'the tick goes back, and it says so';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
