// SCREEN 3 OF 7, AND WHAT A SKILL IS. HER TEXT, UNPARAPHRASED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-skills-copy.mjs
//
// Ruth, 5 October 2026: "Add the screen text to the matrix as the permanent
// record." Same arrangement as the starting guide: one module holds her words,
// the generator copies them into mode-matrix.json, and this compares the two.
//
// AND IT HOLDS THE PRINCIPLE, not only the wording. "Skills is just a place to
// keep the things someone is working on. The user does not know about progression
// ladders and does not need to." Several of the cases below assert the ABSENCE of
// things - rungs, NOW and NEXT, a model call, a count on a card - because the
// screen was built around them and the easiest way for them to return is for
// somebody to think they are helping.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const COPY = await import(root + '/mobile/src/lib/skills-copy.ts');

const matrix = JSON.parse(readFileSync('scripts/mode-matrix.json', 'utf8'));
const screenSrc = readFileSync('mobile/src/app/onboarding/skill.tsx', 'utf8');

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

console.log('\n  SCREEN 3 OF 7: THE RECORD AND THE SCREEN\n');

check('the matrix carries the screen', () => {
  const rec = matrix.skillScreen;
  assert.ok(rec, 'the matrix has no skillScreen record');
  assert.deepStrictEqual(
    rec.screen,
    JSON.parse(JSON.stringify(COPY.SKILL_SCREEN)),
    'the recorded screen text differs from the module'
  );
  assert.deepStrictEqual(
    rec.placements,
    JSON.parse(JSON.stringify(COPY.PLACEMENTS)),
    'the recorded placements differ from the module'
  );
  assert.strictEqual(rec.emptyTab, COPY.SKILLS_EMPTY, 'the empty-tab line differs');
  return 'word for word';
});

check('her eight ideas, in her order', () => {
  assert.deepStrictEqual(
    [...COPY.SKILL_SCREEN.ideas],
    [
      'do a pull-up',
      'run 5 km',
      'touch my toes',
      'carry heavy shopping',
      'get up from the floor easily',
      'swim further',
      'hike all day',
      'play with my children',
    ],
    'the ideas have changed'
  );
  // THE POINT OF THE LIST. Four of the eight are not fitness skills at all, and
  // that is deliberate: the old screen offered five calisthenics ladders because
  // those were the movements the clip library could illustrate, so somebody whose
  // answer was "carry heavy shopping" had nothing to tap.
  const everyday = COPY.SKILL_SCREEN.ideas.filter((i) =>
    /shopping|floor|children|hike/.test(i)
  );
  assert.ok(everyday.length >= 4, 'the ideas have drifted back to gym movements only');
  return 'eight, half of them nothing to do with a gym';
});

check('the ideas are examples, and the box is the answer', () => {
  // Tapping an idea fills the box. Nothing records that one was tapped, and
  // nothing matches what she ends up with against a written ladder.
  assert.ok(
    /onPress=\{\(\) => setText\(idea\)\}/.test(screenSrc),
    'tapping an idea no longer just fills the box'
  );
  // COMMENTS STRIPPED FIRST. The screen explains in a comment that it does NOT
  // use the written ladders, and the first version of this case matched that
  // sentence - a check failing on its own documentation, which this suite has
  // done before.
  const code = screenSrc.replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.ok(
    !/ladder_key:|placeRungs|user_skill_rungs|LADDERS\./.test(code),
    'the screen is matching her words against the written ladders again'
  );
  return 'a tap fills the box, and nothing else happens';
});

check('the screen calls no model', () => {
  // Her point 2: "No model call on this screen."
  assert.ok(
    !/fetch\(|ask-selodia|\/api\//.test(screenSrc),
    'the screen talks to the server for something other than its own save'
  );
  return 'nothing is interpreted, only stored';
});

check('the placement question only appears once she has said something', () => {
  assert.ok(
    /\{entered && \(/.test(screenSrc),
    '"Where are you with it?" is shown above an empty box'
  );
  return 'no question about nothing';
});

check('her own words, with only the first letter changed', () => {
  // "the card title, first letter capitalised, saved exactly as typed"
  assert.strictEqual(COPY.skillTitle('climb snowdon'), 'Climb snowdon');
  assert.strictEqual(COPY.skillTitle('  run 5 km  '), 'Run 5 km');
  assert.strictEqual(COPY.skillTitle('do a PULL-UP'), 'Do a PULL-UP', 'it is tidying her words');
  assert.strictEqual(COPY.skillTitle('touch my toes.'), 'Touch my toes.', 'it removed her full stop');
  assert.strictEqual(COPY.skillTitle(''), '');
  return 'nothing after the first character is touched';
});

check('ladders are off, and still there', () => {
  // Her point 4: "Switch the written ladders OFF with a flag; do not delete them."
  assert.strictEqual(COPY.LADDERS_ENABLED, false, 'the ladders have been switched back on');
  const ladders = readFileSync('mobile/src/lib/skill-ladders.ts', 'utf8');
  assert.ok(ladders.length > 2000, 'the written ladders have been deleted rather than parked');
  assert.ok(/muscle|pull-up/i.test(ladders), 'the ladder content has gone');
  return 'the flag is false and the ladders are intact';
});

check('no rung, no NOW, no NEXT and no Needs on the setup screen', () => {
  for (const banned of ['rung', 'NOW', 'NEXT', 'Needs:']) {
    assert.ok(
      !new RegExp(banned).test(screenSrc.replace(/\/\/[^\n]*/g, '')),
      `the screen says "${banned}" again`
    );
  }
  return 'none of the ladder vocabulary is on it';
});

check('the quick log is text only, with nothing to total', () => {
  // Her point 3, and the constraints are the design. A column this table could
  // sum would be a streak on a card the moment somebody rendered it.
  const sql = readFileSync(
    'supabase/migrations/20261005180000_a_skill_is_her_words_and_a_place_to_keep_notes.sql',
    'utf8'
  );
  assert.ok(/create table if not exists public\.skill_notes/.test(sql), 'there is no notes table');
  assert.ok(/note text not null/.test(sql), 'the note is not plain text');
  // THE COLUMNS, NOT THE PROSE. The table's own COMMENT ON says it carries no
  // counts and no streaks, which the first version of this case read as those
  // words being present. Only the create-table body is tested.
  const from = sql.indexOf('create table if not exists public.skill_notes');
  const body = sql.slice(from, sql.indexOf(');', from));
  assert.ok(
    !/count|streak|session_id|reps|sets|total/i.test(body.replace(/--[^\n]*/g, '')),
    'the notes table has something countable on it'
  );
  return 'a note, a date, and nothing to score';
});

check('and this check can fail', () => {
  const real = COPY.SKILL_SCREEN.question;
  const paraphrased = real.replace('would you love', 'would you like');
  assert.notStrictEqual(paraphrased, real, 'the fixture changed nothing');
  assert.ok(paraphrased !== COPY.SKILL_SCREEN.question, 'a paraphrase compares equal');
  return 'a reworded question is detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
