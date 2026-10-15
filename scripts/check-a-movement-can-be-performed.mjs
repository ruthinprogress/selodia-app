// EVERY MOVEMENT IN A PLAN CAN EITHER BE WATCHED OR BE READ.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-movement-can-be-performed.mjs
//
// Ruth, 15 October 2026, on the plan she built in chat to support her knee and
// took to her specialist: "one one exercise had a video and I have no idea how
// to do the rest. Needs a solution before shipping or it's no use at all."
//
// MEASURED FIRST: 13 of 45 movements across her plans resolve to a
// demonstration. Twenty-nine per cent. Her one-in-five was the normal rate.
//
// AND THE MATCHER IS NOT THE THING TO FIX. movement-demos.ts matches on an
// exact name or an exact word set and nothing weaker, because a subset rule was
// measured and rejected - it matched "kettlebell romanian deadlifts" to the
// single-leg variant. A missing demonstration is a small disappointment; a
// confidently wrong one is a form fault.
//
// SO THE GAP IS CLOSED WITH WORDS. Every movement already carried a safetyNote
// - what can go wrong - and not one carried how to DO it.
//
// WHAT RUTH CHOSE, AND WHY IT IS THIS WAY ROUND: "go, do 2 first and 1 as a
// preference." The other option was to prescribe only movements the library can
// demonstrate, and that is the tail wagging the dog - a knee programme being
// signed off by a consultant must not be bent towards whatever happened to be
// filmed. Words first means the clinically right movement can always be chosen.
//
// Every movement named below is invented.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { howToText } = await import(root + '/app/lib/movement-howto.ts');
const { prepareWorkoutPlan } = await import(root + '/app/lib/almanac.ts');

const read = (path) => readFileSync(path, 'utf8').split(String.fromCharCode(13)).join('');
const howto = read('app/lib/movement-howto.ts');
const almanac = read('app/lib/almanac.ts');
const detail = read('mobile/src/components/almanac-detail.tsx');

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

console.log('\n  A MOVEMENT CAN BE PERFORMED\n');

check('all three lines, or none at all', () => {
  // Two thirds of a description is how somebody sets up correctly and then
  // does the wrong thing with it.
  const whole = howToText({ name: 'X', setUp: 'Lie on your back.', doIt: 'Lift one leg.', feelIt: 'The side of the hip.' });
  assert.ok(whole?.includes('Set up:'), 'a complete description was rejected');
  assert.ok(whole.includes('Do:') && whole.includes('Feel it:'), 'a line is missing from the output');

  for (const partial of [
    { setUp: 'Lie on your back.', doIt: 'Lift one leg.', feelIt: '' },
    { setUp: 'Lie on your back.', doIt: '', feelIt: 'The hip.' },
    { setUp: '', doIt: 'Lift one leg.', feelIt: 'The hip.' },
    { setUp: '   ', doIt: 'Lift.', feelIt: 'Hip.' },
  ]) {
    assert.strictEqual(howToText({ name: 'X', ...partial }), null, 'a partial description was accepted');
  }
  return 'four partials refused';
});

check('the three lines are separate lines', () => {
  // Run together they are the wall of text she spent the same morning
  // removing from chat and from the report.
  const text = howToText({ name: 'X', setUp: 'A.', doIt: 'B.', feelIt: 'C.' });
  assert.strictEqual(text.split('\n').length, 3, 'the description is not three lines');
  return 'one line each';
});

console.log('\n  AND IT IS ONLY WRITTEN WHERE IT IS NEEDED\n');

check('ONLY FOR MOVEMENTS WITH NO CLIP', () => {
  // With a video this is noise, and it is a model call paid for nothing.
  assert.ok(
    /filter\(\(e\) => !e\.demoRef && !e\.howTo\)/.test(almanac),
    'the how-to is written for movements that already have a demonstration, or already have words'
  );
  return 'no clip, and no words yet';
});

check('and after the response, not before it', () => {
  // A plan saves inside a chat turn, and the turn's latency was the day's
  // other subject. The same `after` pattern as the usage and diagnostics
  // writes, for the same reason.
  const scheduler = almanac.slice(almanac.indexOf('function scheduleHowTos'));
  assert.ok(/after\(work\);/.test(scheduler.slice(0, 2000)), 'the work is not deferred past the response');
  assert.ok(!/await writeHowTos/.test(almanac.slice(0, almanac.indexOf('function scheduleHowTos'))), 'it is awaited on the save path');
  return 'the save is as fast as it was';
});

check('a name the writer invented is ignored', () => {
  // It is asked to echo the name back. A name it made up would attach a
  // description to a movement that is not in the plan.
  assert.ok(
    /const asked = batch\.find\(\(n\) => n\.toLowerCase\(\) === \(d\.name \?\? ''\)\.trim\(\)\.toLowerCase\(\)\);/.test(howto),
    'descriptions are not matched back to the names that were asked for'
  );
  assert.ok(/if \(!asked\) continue;/.test(howto), 'an unmatched name is not dropped');
  return 'only names that were asked about';
});

check('AND IT MAY DECLINE, WHICH IS THE POINT', () => {
  // The same rule the clip matcher follows: a wrong description is worse than
  // none. Proved against the instruction, because this is the behaviour being
  // bought and it has to survive a reword.
  assert.ok(
    /return an empty string for it rather than describing the one you assume/.test(howto),
    'the writer is not told it may decline an ambiguous name'
  );
  assert.ok(
    /A wrong description is worse than none/.test(howto),
    'the reason is not written down, so the next edit will remove it'
  );
  return 'ambiguous names come back empty';
});

check('it never writes about the person', () => {
  // These are generated from a movement name alone and go into a document she
  // may hand to a clinician. Nothing about her belongs in them.
  assert.ok(
    /Nothing about who the person is, what condition they have, or what they are recovering from/.test(howto),
    'the writer is not told to stay off the person'
  );
  assert.ok(/No weights, no rep counts, no sets/.test(howto), 'it may contradict the plan it sits in');
  return 'the movement only';
});

console.log('\n  AND IT SURVIVES, AND IT IS SHOWN\n');

check('A RE-SAVE DOES NOT THROW THE WORDS AWAY', () => {
  // A plan edited in conversation is prepared again from its stored content,
  // and anything prepareExercise drops is gone - so a description written an
  // hour ago would be lost and paid for again on every rep-count change.
  const plan = prepareWorkoutPlan({
    programType: 'rehab',
    goal: 'Support the knee',
    exercises: [
      { name: 'Side-lying leg lift', sets: 3, reps: '12 per side', safetyNote: 'Stop if the hip pinches.', howTo: 'Set up: A.\nDo: B.\nFeel it: C.' },
    ],
  });
  assert.ok(plan, 'the plan did not survive preparation');
  assert.strictEqual(plan.exercises[0].howTo, 'Set up: A.\nDo: B.\nFeel it: C.', 'the description was dropped on re-save');
  return 'kept through prepareWorkoutPlan';
});

check('and a plan with no descriptions still prepares', () => {
  const plan = prepareWorkoutPlan({
    programType: 'rehab',
    goal: 'x',
    exercises: [{ name: 'Clamshell', sets: 3, reps: '15' }],
  });
  assert.ok(plan, 'a plan without the new field was refused');
  assert.strictEqual(plan.exercises[0].howTo, null, 'a missing description is not null');
  return 'older plans are unaffected';
});

check('the phone shows it only when there is no clip', () => {
  assert.ok(/!exercise\.demoRef && exercise\.howTo/.test(detail), 'the phone shows words next to a video');
  assert.ok(/How to do it/.test(detail), 'there is no heading on it');
  return 'words instead of a video, never as well';
});

check('THE MOVEMENT COMES FIRST AND THE CAUTION LAST', () => {
  // Ruth, 15 October 2026, looking at the card on her phone: "The body
  // movement info is under the blank movement area which makes it look like
  // its broken. Also the area at the top explaining caution should be at the
  // bottom."
  //
  // Part Ten put the safety note first, on the reasoning that it is what
  // matters before somebody loads a bar. That held while the demonstration was
  // a video she could already picture. It stopped holding the moment the
  // how-to became the thing she opens the card FOR, because a caution read
  // before the movement it describes is a caution about nothing.
  const demo = detail.indexOf('<MovementDemo');
  const words = detail.indexOf('How to do it');
  const safety = detail.indexOf('Before you begin');
  assert.ok(demo > 0 && words > 0 && safety > 0, 'a part of the card is missing');
  assert.ok(words > demo, 'the how-to is above the demonstration slot');
  assert.ok(safety > words, 'the caution is still above the how-to');
  return 'demonstration, words, caution';
});

check('AND THE EMPTY BOX IS NOT DRAWN WHEN THERE ARE WORDS INSTEAD', () => {
  // The thing that made it look broken: an empty framed panel saying there was
  // no demonstration, with the instructions queued underneath it, reads as a
  // video that failed to load.
  assert.ok(
    /\{exercise\.demoRef \|\| !exercise\.howTo \? \(/.test(detail),
    'the demonstration panel is drawn even when words have replaced it'
  );
  return 'the words take the panel place';
});

check('and this check can fail', () => {
  // The weaker version: "a howTo field exists". That passes with the field
  // written for every movement including the ones that have a video, written
  // on the critical path of her turn, and thrown away on the next edit.
  assert.ok(/howTo/.test(almanac), 'the field does not exist at all');
  assert.ok(/filter\(\(e\) => !e\.demoRef/.test(almanac), 'it is written for movements that have a clip');
  assert.strictEqual(
    howToText({ name: 'X', setUp: 'A.', doIt: 'B.', feelIt: '' }),
    null,
    'a partial description is accepted, so the all-three rule is not enforced'
  );
  return 'existence proves nothing; where, when and whether-complete do';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
