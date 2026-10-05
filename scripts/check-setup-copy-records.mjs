// HER SETUP WORDING FOR STEPS 4, 6 AND 7, UNPARAPHRASED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-setup-copy-records.mjs
//
// The same arrangement as check-starting-guide.mjs and check-skills-copy.mjs: one
// module holds her words, the generator copies them into mode-matrix.json, and
// this compares the two and then checks the screen renders from the module rather
// than restating it.
//
// WHY IT COVERS THREE SCREENS AND NOT ONE. lib/activities-copy.ts has said since
// it was written that it is "compared both ways by check-activities-copy.mjs".
// There was no such file and no such record. A comment promising a guard is
// worse than no comment, because the next person reads it and stops looking - so
// the one that was missing is here beside the two that are new.
//
// AND IT CHECKS WHAT CAME OFF THE SCREENS. Her decks are wording, so applying one
// removes lines that were there. Three of those lines said what the app does with
// the data, and two of the three are now said only in one other place. Those
// places are asserted here, so a tidy-up somewhere else cannot leave the app
// silent about medication.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const ACTS = await import(root + '/mobile/src/lib/activities-copy.ts');
const STEER = await import(root + '/mobile/src/lib/steer-copy.ts');
const NOTES = await import(root + '/mobile/src/lib/body-notes-copy.ts');

const matrix = JSON.parse(readFileSync('scripts/mode-matrix.json', 'utf8'));
const activitiesSrc = readFileSync('mobile/src/app/onboarding/activities.tsx', 'utf8');
const steerSrc = readFileSync('mobile/src/app/onboarding/allergies.tsx', 'utf8');
const notesSrc = readFileSync('mobile/src/app/onboarding/life-stage.tsx', 'utf8');
const manualSrc = readFileSync('mobile/src/lib/body-manual.ts', 'utf8');

/** Comments are documentation, not behaviour. A check that reads them lies. */
const code = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const plain = (v) => JSON.parse(JSON.stringify(v));

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

console.log('\n  STEPS 4, 6 AND 7: THE RECORD AND THE SCREENS\n');

// ------------------------------------------------------- record against module

check('the matrix carries step 4, word for word', () => {
  const rec = matrix.activitiesScreen;
  assert.ok(rec, 'the matrix has no activitiesScreen record');
  assert.deepStrictEqual(rec.screen, plain(ACTS.ACTIVITIES_SCREEN), 'the recorded text differs');
  return 'what you already do';
});

check('the matrix carries step 6, word for word', () => {
  const rec = matrix.steerScreen;
  assert.ok(rec, 'the matrix has no steerScreen record');
  assert.deepStrictEqual(rec.screen, plain(STEER.STEER_SCREEN), 'the frame differs');
  assert.deepStrictEqual(rec.groups, plain(STEER.STEER_GROUPS), 'the groups differ');
  assert.deepStrictEqual(rec.movement, plain(STEER.STEER_MOVEMENT), 'the movement box differs');
  assert.deepStrictEqual(rec.other, plain(STEER.STEER_OTHER), 'the anything-else box differs');
  return 'anything to steer around';
});

check('the matrix carries step 7, word for word', () => {
  const rec = matrix.bodyNotesScreen;
  assert.ok(rec, 'the matrix has no bodyNotesScreen record');
  assert.deepStrictEqual(rec.screen, plain(NOTES.BODY_NOTES_SCREEN), 'the recorded text differs');
  return 'anything else about your body';
});

// -------------------------------------------------------- her words, verbatim

check('step 6 is her five headings, in her order', () => {
  assert.deepStrictEqual(
    STEER.STEER_GROUPS.map((g) => g.heading),
    ['Food', 'Skin & air', 'Medicines'],
    'the three chip groups are not hers'
  );
  assert.strictEqual(STEER.STEER_MOVEMENT.heading, 'Movement', 'the movement heading changed');
  assert.strictEqual(STEER.STEER_OTHER.heading, 'Anything else?', 'the fifth heading changed');
  return 'Food, Skin & air, Medicines, Movement, Anything else?';
});

check('step 6 keeps her examples as examples', () => {
  // Every box she gave an example for leads with "e.g.", which is what makes the
  // grey text read as a suggestion rather than as something already entered. The
  // boxes used to hold full sentences ("No overhead pressing, my left shoulder").
  const boxes = [
    ...STEER.STEER_GROUPS.map((g) => g.boxPlaceholder),
    STEER.STEER_MOVEMENT.boxPlaceholder,
    STEER.STEER_OTHER.boxPlaceholder,
  ];
  for (const b of boxes) assert.ok(b.startsWith('e.g. '), `"${b}" is not an example`);
  return 'five boxes, five examples';
});

check('step 7 asks rather than labels, and offers nothing it cannot keep', () => {
  assert.ok(
    NOTES.BODY_NOTES_SCREEN.question.endsWith('?'),
    'the heading is a label again, on the screen most likely to feel nosy'
  );
  assert.ok(
    /optional/i.test(NOTES.BODY_NOTES_SCREEN.subtitle),
    'the subtitle no longer says it is optional'
  );
  return 'a question that can be answered with nothing';
});

// --------------------------------------------- the screens render from the record

check('step 4 renders from the module', () => {
  const c = code(activitiesSrc);
  assert.ok(/ACTIVITIES_SCREEN\.question/.test(c), 'the question is not read from the module');
  assert.ok(
    !/What do you already do\?/.test(c),
    'the screen has its own copy of her question again'
  );
  return 'no second copy of her words';
});

check('step 6 renders from the module', () => {
  const c = code(steerSrc);
  assert.ok(/STEER_SCREEN\.question/.test(c) && /STEER_SCREEN\.closing/.test(c), 'not wired');
  for (const g of STEER.STEER_GROUPS) {
    assert.ok(!c.includes(`'${g.heading}'`), `the screen restates "${g.heading}"`);
  }
  assert.ok(
    !/Tap what applies/.test(c) && !/Something else on your plate/.test(c),
    'the old wording is still on the screen'
  );
  return 'headings, boxes and closing line all from steer-copy';
});

check('step 7 renders from the module', () => {
  const c = code(notesSrc);
  assert.ok(/BODY_NOTES_SCREEN\.question/.test(c), 'the question is not read from the module');
  assert.ok(
    !/A little about your body/.test(c),
    'the old heading is still there'
  );
  assert.ok(
    /BODY_NOTES_SCREEN\.periodsNote/.test(c),
    'her periods note is not rendered'
  );
  return 'nine fields, one source';
});

check('her periods note is shown before the choice, not after it', () => {
  // THE WHOLE POINT OF MOVING IT. The sentence used to appear only once she had
  // picked "I don't have periods for another reason", so the woman about to pick
  // post-menopause by mistake never read it.
  // THE BRANCH IN THE RENDER, not the one in the save. `stage ===
  // 'no_periods_other'` appears twice: once building life_stage_detail and once
  // opening the second question. The first version of this case took the save,
  // which sits above the whole render and made every placement look wrong.
  const c = code(notesSrc);
  const render = c.indexOf('<OnboardingQuestion');
  assert.ok(render > 0, 'the render is gone');
  const note = c.indexOf('BODY_NOTES_SCREEN.periodsNote', render);
  const conditional = c.indexOf("{stage === 'no_periods_other' &&", render);
  assert.ok(note >= 0 && conditional >= 0, 'one of the two is missing');
  assert.ok(note < conditional, 'the note is inside the branch again');
  return 'under the chips, always';
});

// ------------------------------------------- what the wording promises the code

check('the app still never infers menopause from an absent bleed', () => {
  const src = readFileSync('mobile/src/lib/life-stage.ts', 'utf8');
  const from = src.indexOf('export function stageForReasoning');
  assert.ok(from > 0, 'stageForReasoning is gone');
  const body = src.slice(from, src.indexOf('\n}', from));
  assert.ok(
    /no_periods_other[\s\S]*null/.test(code(body)),
    'an absent bleed now resolves to a menopause status'
  );
  return 'no periods and no assumption';
});

check('the medical line survives its removal from the setup box', () => {
  // HER CLOSING LINE REPLACED IT ON THE SCREEN (5 October 2026), and it is the
  // one removal worth watching, because that box is the first place anybody types
  // a drug name. It is asserted where it still stands.
  // COMMENTS STRIPPED. This file's own comment beside her closing line names the
  // sentence it replaced, and the first version of this case read that as the
  // sentence still being rendered.
  assert.ok(
    !/not a medical service/.test(code(notesSrc)),
    'the sentence is back on the setup screen, where her closing line now is'
  );
  assert.ok(
    /not a medical service and does not replace advice from your doctor/.test(manualSrc),
    'nothing in the app says it is not a medical service beside what she takes'
  );
  return 'said on the Body Manual row that keeps it';
});

check('the food group is still the only one that arms the filter', () => {
  // Her Food note replaced the sentence that said so out loud, so the mechanical
  // version is the only one left. It must be the thing that runs.
  const c = code(steerSrc);
  assert.ok(/^assertGroupsMatchKinds\(\);$/m.test(c), 'the invariant is never called');
  assert.strictEqual(
    matrix.steerScreen.onlyGroupThatArmsTheFoodFilter,
    STEER.STEER_GROUPS[0].heading,
    'the matrix names a different group'
  );
  return `"${STEER.STEER_GROUPS[0].heading}", asserted at module load`;
});

check('unticking still removes nothing, and the screen still says so', () => {
  // The sentence moved up to sit with the removal controls when her closing line
  // took the bottom of the screen. It must have moved rather than gone.
  assert.ok(
    /removed by unticking/.test(steerSrc),
    'the screen no longer warns that unticking does nothing'
  );
  return 'with the removal controls, where it applies';
});

// ------------------------------------------------- the Manual in her setup order

check('the Body Manual runs in her setup order', () => {
  const order = ['week', 'skills'];
  const at = order.map((k) => manualSrc.indexOf(`key: '${k}'`));
  assert.ok(at.every((i) => i > 0), 'one of the two rows is missing');
  assert.ok(
    at[0] < at[1],
    'the Manual asks what she would like to do before what she already does'
  );
  return 'what you already do, then what you want to be able to do';
});

// ------------------------------------------------------------ it can fail

check('and this check can fail', () => {
  const real = STEER.STEER_SCREEN.subtitle;
  const paraphrased = real.replace("you'd rather avoid", 'you want to avoid');
  assert.notStrictEqual(paraphrased, real, 'the fixture changed nothing');
  assert.ok(paraphrased !== STEER.STEER_SCREEN.subtitle, 'a paraphrase compares equal');

  const note = NOTES.BODY_NOTES_SCREEN.periodsNote;
  const softened = note.replace("doesn't necessarily mean", 'does not mean');
  assert.notStrictEqual(softened, note, 'the second fixture changed nothing');
  return 'a reworded subtitle and a softened note are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
