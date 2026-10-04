// DOES ANYTHING ACTUALLY READ WHAT SHE SWITCHED ON?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-tracked-macros-reach-chat.mjs
//
// Ruth asked "What about saturated fat in the past week?" and was told: "That's
// not something your record tracks - I've got calories and protein logged, but
// no breakdown of fat types. If it matters to you, your GP or a food diary with
// that detail would be the place to look."
//
// Every word of it was wrong. Every meal she had logged since 27 September
// carried a saturated_fat_g - 38g on the Sunday pizza, 29.6g on the four-egg
// omelette - and she had switched all six optional macros on in "What I track",
// stored in user_profile.tracked_macros since 24 September.
//
// THE PARSE CAPTURED IT. THE COLUMN HELD IT. THE SETTING RECORDED THAT SHE
// WANTED IT. And nothing on the server read either one: the food handed to the
// model was built as `raw_text + ' (' + kcal + 'kcal, ' + protein_g + 'g
// protein)'`, so six figures sat on the row and never reached the page.
//
// COLLECTED, STORED, AND READ BY NOBODY - the third instance found on 4 October
// alone, after the duplicate guard that could not see a backdated meal and the
// named day that had nowhere to go. This one is the worst of the three because
// it did not merely fail to answer: it asserted an absence, and she acted on it
// by going to switch on a setting that was already on.
//
// So this check is about the WIRE, not the arithmetic. The function can be
// perfect and the bug returns the moment nothing calls it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { trackedMacroKeys, buildTrackedMacroBlock } = await import(
  root + '/app/lib/tracked-macro-summary.ts'
);

let pass = 0;
const failures = [];
// AWAITED. The first version did not, so an async case's assertions ran after
// the tally was printed and the case could never fail - the one thing a check
// must be able to do.
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

console.log('\n  WHAT SHE SWITCHED ON REACHES THE MODEL\n');

await check('the setting is read at all', () => {
  assert.ok(
    /tracked_macros/.test(route),
    'ask-selodia never mentions tracked_macros, so what she switched on in ' +
      '"What I track" is stored and read by nobody - exactly as it was when she ' +
      'was told her record does not keep saturated fat'
  );
  assert.ok(
    /buildTrackedMacroBlock\(/.test(route),
    'nothing builds the block, so the figures stay on the row and off the page'
  );
  return 'read, and turned into something';
});

await check('the block reaches the prompt, not just a variable', () => {
  // THE FAILURE MODE THIS GUARDS. A block that is built and never interpolated
  // is indistinguishable, from the model's side, from one that was never built -
  // and it looks entirely correct in a code review.
  assert.ok(
    /\$\{trackedMacroBlock\}/.test(route),
    'trackedMacroBlock is built and never interpolated into the prompt'
  );
  return 'interpolated beside the day state';
});

await check('only the macros she actually switched on', () => {
  assert.deepStrictEqual(trackedMacroKeys(null), []);
  assert.deepStrictEqual(trackedMacroKeys(['saturated', 'fibre']), ['saturated', 'fibre']);
  // Calories and protein are never toggles and must not appear as ones.
  assert.deepStrictEqual(trackedMacroKeys(['kcal', 'protein', 'sugar']), ['sugar']);
  assert.deepStrictEqual(trackedMacroKeys(['nonsense', 42, null, 'salt']), ['salt']);
  return 'unknown keys dropped, kcal and protein never toggles';
});

await check('tracking nothing optional costs no query and says nothing', async () => {
  // An empty block and a block saying "nothing is tracked" are different claims.
  let called = false;
  const spy = { from() { called = true; throw new Error('should not query'); } };
  const out = await buildTrackedMacroBlock(spy, 'u', []);
  assert.strictEqual(out, '', 'a block was produced for somebody tracking nothing');
  assert.strictEqual(called, false, 'it queried anyway');
  return 'no query, no claim';
});

await check('the rendered block forbids the sentence she actually got', async () => {
  // READ THE OUTPUT, NOT THE SOURCE. The first version matched the module's
  // text and failed on its own line wrapping: the sentence is built by template
  // concatenation, so "never send her elsewhere" and "for it" are not adjacent
  // in the file. A check that reads a spelling rather than a result reports on
  // formatting - the same lesson as the comment-stripping in
  // check-ask-about-this.mjs, one layer along.
  const rows = [
    { happened_at: '2026-10-03T12:00:00Z', saturated_fat_g: 12 },
    { happened_at: '2026-10-02T12:00:00Z', saturated_fat_g: 8 },
  ];
  const stub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => ({ limit: async () => ({ data: rows, error: null }) }),
          }),
        }),
      }),
    }),
  };
  const out = await buildTrackedMacroBlock(stub, 'u', ['saturated']);
  assert.ok(out.length > 0, 'no block was produced');
  assert.ok(/not tracked/.test(out), 'the block never forbids claiming it is untracked');
  assert.ok(/send her elsewhere/.test(out), 'nothing stops it pointing her at her GP');
  assert.ok(/12g saturated fat/.test(out), `the figures are missing: ${out.slice(-120)}`);
  assert.ok(/What I track/.test(out), 'it does not say where she switched these on');
  return 'the figures, and the instruction, in the text the model receives';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
