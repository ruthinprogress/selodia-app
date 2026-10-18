// CHANGING HOW LONG SOMETHING LASTED, FIRST TIME OF ASKING.
//
//   node scripts/check-duration-correction.mjs
//
// Ruth, 18 October 2026. She logged "3 hours paired rope climbing", chat
// correctly worked out that the real climbing time was less, offered to amend
// it - and then failed three times running:
//
//   "That change didn't go through, so your climbing is still logged as 180
//    minutes of hard climbing."
//   "That change didn't go through either."
//   "That didn't go through either, sorry... asking a third time isn't going to
//    change it."
//
// Her finding: "the chat logged climbing, but said it couldn't change the
// duration, told me i coukd do it, but i actually can't."
//
// THE CAUSE WAS THE RETRY ADVICE BEING WRONG, not the write. An activity
// correction re-read the person's whole message as a fresh log and swapped the
// rows. The reply had just asked her which figure to use, so her message was
// the single word "90" - which contains no activity, so the parser returned
// nothing and the branch honestly reported that nothing had changed. Every
// retry fed the same bare number to the same parser. It could not have worked.
//
// AND THE APP SENT HER TO A SCREEN THAT DOES NOT EXIST: "go to Log, then
// Activity, tap today's rope climbing entry and change it to 90." The history
// there is a record with one link on it, back to chat.

import assert from 'node:assert';
import fs from 'node:fs';

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
const structure = fs.readFileSync('app/lib/app-structure.ts', 'utf8');
const dayLog = fs.readFileSync('mobile/src/components/day-log.tsx', 'utf8');

console.log('\n  A LENGTH CAN BE CORRECTED\n');

check('THE MODEL CAN HAND OVER THE CORRECTED NUMBER', () => {
  // Without a field for it, the only way to learn the new figure was to re-read
  // her message - and her message was "90".
  assert.ok(/correctionDurationMin: \{/.test(route), 'there is no field for the corrected length');
  assert.ok(
    /correctionDurationMin\?: number;/.test(route),
    'the corrected length never reaches the handler'
  );
  // The description has to tell the model to send it for a bare number, which
  // is the exact case that failed.
  const at = route.indexOf('correctionDurationMin: {');
  const field = route.slice(at, at + 1200);
  assert.ok(
    /even if their message is only a number/i.test(field),
    'nothing tells the model to send the figure when the message is just "90"'
  );
  return 'field, type and the instruction that matters';
});

check('AND IT IS WRITTEN IN PLACE, NOT DELETED AND RE-LOGGED', () => {
  const at = route.indexOf('const correctedMinutes =');
  assert.ok(at > -1, 'the in-place path is gone');
  // Wide enough to reach past the reasoning between the guard and the write.
  // Three of these windows were too small the moment the block grew, which is
  // its own small lesson about slicing source by a character count.
  const body = route.slice(at, at + 4000);
  assert.ok(
    /patch\.duration_min = correctedMinutes/.test(body),
    'the duration is not updated'
  );
  assert.ok(/\.update\(/.test(body), 'it no longer updates the row it already has');
  assert.ok(
    !/\.delete\(\)/.test(body),
    'the length correction deletes the row again, which is what lost the entry before'
  );
  // It must be guarded, or a zero or a NaN silently blanks a real entry.
  assert.ok(/Number\.isFinite\(result\.correctionDurationMin\)/.test(route), 'no guard on the number');
  assert.ok(/result\.correctionDurationMin > 0/.test(route), 'zero or negative minutes are accepted');

  // AND THE PATH HAS TO ACTUALLY BE TAKEN, which the first version of this
  // check did not test. Disabling the branch left every assertion above
  // passing, because they all read the body rather than the condition that
  // reaches it - a check that cannot fail on the regression it was written
  // for. Found by mutating the branch to `if (false)` and watching it pass.
  assert.ok(
    /if \(correctedMinutes != null \|\|/.test(route),
    'the in-place update is no longer reached when a corrected length arrives'
  );
  return 'one row, one column, guarded, and actually entered';
});

check('the re-log path survives for everything that is NOT a length', () => {
  // The delete-then-re-log reasoning is still right when the correction rewrites
  // what the activity WAS: one message can split into several rows, so
  // "replace row X" is not well defined. Only the length case skips it.
  assert.ok(
    /logActivityFromText\(supabase, user\.id, message\)/.test(route),
    'the general activity correction was removed along with the bug'
  );
  const at = route.indexOf('const correctedMinutes =');
  const after = route.slice(at, at + 6000);
  const relogAt = after.indexOf('logActivityFromText');
  const elseAt = after.indexOf('} else {');
  assert.ok(elseAt > -1 && relogAt > elseAt, 'the re-log no longer sits behind the else');
  return 'in place for a length, re-log for the rest';
});

check('A CHANGED LENGTH TAKES THE CALORIES WITH IT', () => {
  // Ruth, an hour after the in-place update shipped: "Climbing still says
  // 720kcal for 60mins...cant be the sane estimate as for 90mins".
  //
  // The new path changed duration_min and nothing else, so kcal_burned went on
  // describing a session that no longer existed. A stored figure left behind by
  // the thing it was derived from - the fault the whole day was spent on,
  // introduced by the fix for the previous one.
  assert.ok(
    /priorKcal \* \(correctedMinutes \/ priorMin\)/.test(route),
    'a change of length no longer rescales the calories'
  );
  // Guarded, or a zero prior duration divides by zero and writes NaN over a
  // real figure.
  assert.ok(/priorMin > 0/.test(route), 'the scale can divide by zero');
  assert.ok(/priorKcal > 0/.test(route), 'it scales a figure that was never there');
  return 'scaled by the new time, guarded both ways';
});

check('AND A CHANGED EFFORT CLEARS THEM RATHER THAN KEEPING A WRONG ONE', () => {
  // Scaling cannot cross efforts: an hour of hard climbing and an hour of
  // moderate climbing differ by exactly the thing being corrected. The app's
  // own standing rule, in the activity parse prompt: "a made-up 30 minutes
  // becomes a made-up calorie burn, and the person is then shown a number about
  // their day that nobody measured."
  assert.ok(/correctionIntensity: \{/.test(route), 'the effort cannot be corrected at all');
  assert.ok(/correctionKcal: \{/.test(route), 'the model cannot hand over a corrected figure');
  const at = route.indexOf('const correctedIntensity =');
  // Wide enough for the reasoning that sits between the two, which is most of
  // the length here. Measured rather than guessed.
  const body = route.slice(at, at + 4000);
  assert.ok(
    /patch\.kcal_burned = null;/.test(body),
    'a corrected effort keeps the old calorie figure, which is now about a session that did not happen'
  );
  // And the model is told to send a figure, so the null is the fallback rather
  // than the usual outcome.
  assert.ok(
    /SEND THIS WHENEVER YOU CORRECT THE INTENSITY/.test(route),
    'nothing asks the model for a figure when it changes the effort'
  );
  return 'null, not a wrong number';
});

check('AND NOBODY IS SENT TO AN EDIT SCREEN THAT DOES NOT EXIST', () => {
  // THE OTHER HALF, and the one she actually went looking for. The movement
  // history has exactly one link on an entry and it comes back to chat.
  assert.ok(
    /Ask about or change this/.test(dayLog),
    'the history link changed name, so this check is testing nothing'
  );
  assert.ok(
    !/onPress=\{\(\) => onEdit/.test(dayLog),
    'an edit route appeared - update the app map, which says there is none'
  );
  assert.ok(
    /THE HISTORY IS A RECORD AND NOT AN EDITOR/.test(structure),
    'the app map no longer says the history cannot be edited, so the model will invent it again'
  );
  assert.ok(
    /never send somebody to a screen to fix an entry themselves/i.test(structure),
    'nothing forbids describing a screen that does not exist'
  );
  return 'the map says what the screen actually does';
});

check('and the app map mentions the diary it now has', () => {
  // Added the same afternoon, which is exactly when a map goes stale.
  assert.ok(/Coming up/.test(structure), 'Now has a diary section the app map does not know about');
  assert.ok(
    !/two sections that fold away/.test(structure),
    'the map still counts two folding sections on Now, and there are three'
  );
  return 'three sections, and the diary is named';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
