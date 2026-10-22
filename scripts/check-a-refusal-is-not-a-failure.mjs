// "ASK ME AGAIN" IS THE WRONG THING TO SAY ABOUT A REFUSAL.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-refusal-is-not-a-failure.mjs
//
// Ruth's chat, 21 October 2026, twice in one conversation: "my note to keep
// watching for them didn't save, so it may not carry over to later
// conversations." She had asked it to watch her calcium and iron.
//
// Nothing had failed. Calcium is not one of the health markers this app keeps,
// so the proposal was REFUSED - correctly, and permanently. But commitSave
// returns null for a refusal and null for a failed write, and saveAppliedNote
// had one sentence for both: "That didn't save just now. Ask me again and I'll
// try once more."
//
// Asking again would have refused again. Every time. Which is how somebody
// ends up being told three times that a write failed, going to check a setting
// that was never involved, and finally reporting the whole thing as a bug -
// all of which happened.
//
// THE PROJECT HAD ALREADY LEARNED THIS ONCE, about the diary: "A REFUSAL IS AN
// OUTCOME TOO. checkCalendarEvent already declines a date in the past... and
// that reason has to travel: 'I put it in' and 'I would not put it in because
// it is already gone' are different things to be told." This path never got
// its half, and the symptom was identical: a confident, wrong, repeatable
// sentence about a write.
//
// WHAT THIS GUARDS: that the two outcomes stay different sentences, and that a
// refusal never invites a retry that cannot work.

import assert from 'node:assert';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { commitSave, saveAppliedNote } = await import(here('app/lib/pending-save.ts'));

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

// A database that always succeeds, so nothing here can be mistaken for a write
// failure. Anything that comes back null did so because it was refused.
const OK_DB = { from: () => ({ upsert: async () => ({ error: null }) }) };

console.log('\n  A REFUSAL IS NOT A FAILURE\n');

await (async () => {
  const refused = await commitSave(OK_DB, 'u', {
    type: 'marker',
    title: 'calcium',
    content: { marker: 'calcium', status: 'watching' },
  });
  const refusedNote = saveAppliedNote(refused, true);
  const failedNote = saveAppliedNote(null, true);

  check('HER OWN CASE NO LONGER BLAMES A WRITE', () => {
    assert.strictEqual(refused, null, 'an unknown marker was written after all');
    assert.ok(refusedNote, 'a refusal says nothing at all');
    assert.ok(/calcium/.test(refusedNote), `it does not name what it refused: ${refusedNote}`);
    assert.ok(!/didn't save/.test(refusedNote), `it still blames a write: ${refusedNote}`);
    return 'it names calcium';
  });

  check('AND DOES NOT ASK HER TO TRY AGAIN', () => {
    // The sentence that cost her the afternoon. A retry of a refusal is
    // refused identically, so inviting one is worse than saying nothing.
    assert.ok(!/ask me again/i.test(refusedNote), `it invites a doomed retry: ${refusedNote}`);
    assert.ok(!/try once more/i.test(refusedNote), `it invites a doomed retry: ${refusedNote}`);
    assert.ok(/would not change it|nothing was lost/i.test(refusedNote), refusedNote);
    return 'no retry offered';
  });

  check('WHILE A REAL FAILURE STILL SAYS TRY AGAIN', () => {
    // The fix must not cost the case the sentence was written for: a write
    // that genuinely failed is worth another go.
    assert.ok(/ask me again/i.test(failedNote), `a real failure lost its retry: ${failedNote}`);
    assert.notStrictEqual(refusedNote, failedNote, 'the two outcomes still read identically');
    return 'the two are different sentences';
  });

  check('AND A TURN THAT ATTEMPTED NOTHING SAYS NOTHING', () => {
    assert.strictEqual(saveAppliedNote(null, false), null, 'a turn with no save spoke anyway');
    return 'silent when nothing was tried';
  });

  // A SECOND SAVE, REFUSED AND THEN NEVER READ, followed by a real failure.
  // Without the clear on the way IN, the second turn would report the first
  // turn's refusal - a sentence about calcium in answer to something else
  // entirely. This is the exact hazard module scope buys.
  const FAILING_DB = { from: () => ({ upsert: async () => ({ error: { message: 'nope' } }) }) };
  await commitSave(OK_DB, 'u', {
    type: 'marker',
    title: 'magnesium',
    content: { marker: 'magnesium', status: 'watching' },
  });
  // A REAL marker and a real status, so this one reaches the write and the
  // write is what fails. The first version used 'ldl'/'high' - neither is in
  // MARKER_COLUMNS or MARKER_STATUSES - so it was refused too and never
  // exercised the thing it was testing.
  const afterStale = await commitSave(FAILING_DB, 'u', {
    type: 'marker',
    title: 'LDL',
    content: { marker: 'ldl_status', status: 'elevated' },
  });
  const afterStaleNote = saveAppliedNote(afterStale, true);

  check('AND A REFUSAL NEVER ANSWERS THE NEXT TURN', () => {
    assert.strictEqual(afterStale, null, 'the failing write reported success');
    assert.ok(
      !/magnesium/.test(afterStaleNote),
      `a previous turn's refusal answered this one: ${afterStaleNote}`
    );
    assert.ok(/ask me again/i.test(afterStaleNote), afterStaleNote);
    return 'cleared on the way in';
  });

  check('AND A REFUSAL DOES NOT LEAK INTO THE NEXT SAVE', () => {
    // Module scope is how this is carried, which is the same shape the skill
    // outcome uses - and the risk that comes with it is a stale value being
    // read as the current turn's answer. It is cleared on the way in and on
    // the way out.
    const second = saveAppliedNote(null, true);
    assert.ok(/ask me again/i.test(second), `the previous refusal was read again: ${second}`);
    return 'cleared once read';
  });
})();

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
