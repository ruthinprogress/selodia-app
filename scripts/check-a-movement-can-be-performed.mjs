// EVERY MOVEMENT IN A PLAN CAN EITHER BE WATCHED OR BE DONE FROM THE CARD.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-movement-can-be-performed.mjs
//
// Ruth, 15 October 2026: "one one exercise had a video and I have no idea how
// to do the rest. Needs a solution before shipping or it's no use at all."
// Thirteen of her forty-five movements had a demonstration.
//
// AND THE FIRST ANSWER WAS THE WRONG SHAPE. It wrote three prose lines - set
// up, do, feel it - which with the safety note came to about two hundred
// words. Her verdict the next morning: "The page is asking people to study
// when they came to move... she has a small amount of motivation and reading
// uses it up. Use it up reading a bunch and the moment passes and you've not
// moved."
//
// So it is a card now, around forty-five words: what she needs to hand, the
// movement as three to five numbered actions, where to feel it, and the one or
// two things that go wrong. The long safety note sits behind a tap.
//
// THE MATCHER IS STILL NOT THE THING TO FIX. movement-demos.ts matches on an
// exact name or an exact word set and nothing weaker, because a subset rule
// was measured and rejected - it matched "kettlebell romanian deadlifts" to
// the single-leg variant. A missing demonstration is a small disappointment; a
// confidently wrong one is a form fault.
//
// Every movement named below is invented.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { howToCard } = await import(root + '/app/lib/movement-howto.ts');
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

const CARD = {
  name: 'X',
  needs: ['One dumbbell'],
  steps: ['Stand tall.', 'Rise onto your toes.', 'Lower for three seconds.'],
  feel: 'The back of your lower leg.',
  avoid: ["Don’t bounce at the bottom."],
};

console.log('\n  A MOVEMENT CAN BE PERFORMED\n');

check('steps and a feel, or nothing at all', () => {
  // Steps with no feel is a sequence she cannot check herself against. A feel
  // with no steps is a destination with no route.
  assert.ok(howToCard(CARD), 'a complete card was rejected');
  for (const partial of [
    { needs: [], steps: [], feel: 'The calf.', avoid: [] },
    { needs: [], steps: ['Stand tall.'], feel: '', avoid: [] },
    { needs: [], steps: [], feel: '', avoid: [] },
  ]) {
    assert.strictEqual(howToCard({ name: 'X', ...partial }), null, 'a partial card was accepted');
  }
  return 'three partials refused';
});

check('a bodyweight movement needs nothing, and that is allowed', () => {
  const card = howToCard({ ...CARD, needs: [], avoid: [] });
  assert.ok(card, 'a bodyweight card was refused');
  assert.deepStrictEqual(card.needs, []);
  assert.deepStrictEqual(card.avoid, []);
  return 'empty needs and empty avoid are both fine';
});

check('IT IS A CARD, NOT AN ESSAY', () => {
  // The whole redesign in one assertion: "Nobody reads 200 words before doing
  // a calf raise."
  const card = howToCard({ ...CARD, steps: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.ok(card.steps.length <= 5, `${card.steps.length} steps survived; a card is at most five`);
  return 'capped at five steps';
});

console.log('\n  AND IT IS ONLY WRITTEN WHERE IT IS NEEDED\n');

check('ONLY FOR MOVEMENTS WITH NO CLIP', () => {
  assert.ok(
    /filter\(\(e\) => !e\.demoRef && !e\.howTo\)/.test(almanac),
    'a card is written for movements that already have a demonstration, or already have one'
  );
  return 'no clip, and no card yet';
});

check('and after the response, not before it', () => {
  const scheduler = almanac.slice(almanac.indexOf('function scheduleHowTos'));
  assert.ok(/after\(work\);/.test(scheduler.slice(0, 2000)), 'the work is not deferred past the response');
  return 'the save is as fast as it was';
});

check('a name the writer invented is ignored', () => {
  assert.ok(/if \(!asked\) continue;/.test(howto), 'an unmatched name is not dropped');
  return 'only names that were asked about';
});

check('AND IT MAY DECLINE, WHICH IS THE POINT', () => {
  assert.ok(
    /return empty arrays and an empty feel rather than describing the one you assume/.test(howto),
    'the writer is not told it may decline an ambiguous name'
  );
  assert.ok(/A wrong description is worse than none/.test(howto), 'the reason is not written down');
  return 'ambiguous names come back empty';
});

check('it never writes about the person', () => {
  assert.ok(
    /nothing about who they are or what they are recovering from/.test(howto),
    'the writer is not told to stay off the person'
  );
  assert.ok(/No weights, no rep counts, no sets/.test(howto), 'it may contradict the plan it sits in');
  return 'the movement only';
});

console.log('\n  AND IT SURVIVES, AND IT IS SHOWN\n');

check('A RE-SAVE KEEPS THE CARD', () => {
  const card = { needs: ['A mat'], steps: ['Lie on your side.', 'Lift the top leg.'], feel: 'The side of your hip.', avoid: ["Don’t roll back."] };
  const plan = prepareWorkoutPlan({
    programType: 'rehab',
    goal: 'Support the knee',
    exercises: [{ name: 'Side-lying leg lift', sets: 3, reps: '12 per side', howTo: card }],
  });
  assert.ok(plan, 'the plan did not survive preparation');
  assert.deepStrictEqual(plan.exercises[0].howTo, card, 'the card was dropped on re-save');
  return 'kept through prepareWorkoutPlan';
});

check('AND THE OLD PROSE SHAPE IS DROPPED, NOT GUESSED AT', () => {
  // Three prose lines cannot be split into steps without inventing where one
  // ends, and inventing the steps of a movement is the one thing this feature
  // must not do. Those rows are regenerated instead.
  const plan = prepareWorkoutPlan({
    programType: 'rehab',
    goal: 'x',
    exercises: [{ name: 'Clamshell', sets: 3, reps: '15', howTo: 'Set up: A.\nDo: B.\nFeel it: C.' }],
  });
  assert.strictEqual(plan.exercises[0].howTo, null, 'a prose how-to survived as a card');
  return 'regenerated rather than converted';
});

check('the phone shows it only when there is no clip', () => {
  assert.ok(/!exercise\.demoRef && exercise\.howTo/.test(detail), 'the phone shows a card next to a video');
  assert.ok(/exercise\.howTo\.steps\.map/.test(detail), 'the steps are not drawn');
  return 'a card instead of a video, never as well';
});

check('THE STEPS ARE NUMBERED AND THE LONG NOTE IS BEHIND A TAP', () => {
  assert.ok(/\{`\$\{i \+ 1\}`\}/.test(detail), 'the steps are not numbered');
  assert.ok(/What usually goes wrong/.test(detail), 'the note has no title that says what is behind it');
  assert.ok(/openNote === exercise\.name/.test(detail), 'the note is not collapsible');
  // Shut unless asked for: the card is what she opened the screen for.
  assert.ok(/useState<string \| null>\(null\)/.test(detail), 'the note is open by default');
  return 'numbered, and the note starts shut';
});

check('and this check can fail', () => {
  assert.strictEqual(
    howToCard({ name: 'X', needs: [], steps: ['A.'], feel: '', avoid: [] }),
    null,
    'a card with no feel is accepted, so the rule is not enforced'
  );
  assert.ok(!/howToText/.test(howto), 'the old prose builder is still exported');
  return 'the old shape is gone and the new rule holds';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
