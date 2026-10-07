// THE APP IT DESCRIBES HAS TO BE THE APP THAT EXISTS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-no-invented-screens.mjs
//
// 7 OCTOBER 2026, 09:11. Ruth tapped through from Tuesday's log, the meal ended
// up on Wednesday, and when she said so she was told:
//
//   "I don't have a way to move an entry's date from here - that'd need to
//   happen in the log itself, where you can edit the date on that entry
//   directly."
//
// There is no editor in the log. food-breakdown-card.tsx says so in its own
// comment: "No editor was built, because there is already a way to change an
// entry and a second one would be a second set of rules about the same data."
// Tapping an entry opens the conversation. There is no field to type a date
// into, on that screen or any other.
//
// THIS IS THE THIRD TIME AND THE SHAPE IS ALWAYS THE SAME. 30 September: told it
// could not write to the Me tab, so it said the capability did not exist.
// 1 October: told it could write to the Me tab and nothing else, so it mapped her
// week onto the Me tab and defended it. 6 October: "redo setup replays it",
// offering a route deleted four days earlier at her own request. A model that is
// not told what the screens do will describe screens that would make its answer
// true.
//
// SO THE PROMPT CARRIES THE FACT, NOT A BAN. Same lesson as last night's
// guideline figures: an instruction not to say a thing, with nothing true to say
// instead, loses to whatever is most helpful-sounding. This one names what is
// impossible AND what works instead, which is delete and re-log on the right day.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { REPLY_PROMPT_PARTS, replyPrompt } = await import(root + '/app/lib/reply-prompt.ts');

const card = readFileSync('mobile/src/components/food-breakdown-card.tsx', 'utf8');
const correction = readFileSync('app/lib/log-correction.ts', 'utf8');

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

console.log('\n  NO SCREEN THAT DOES NOT EXIST\n');

check('the log really has no editor, which is why this rule is true', () => {
  // THE CLAIM IS CHECKED AGAINST THE SCREEN, not asserted. If an editor is ever
  // built, this check fails and the prompt has to be rewritten rather than
  // quietly becoming a lie in the other direction.
  assert.ok(
    /No editor was built/.test(card),
    'the log may have gained an editor, in which case the prompt rule below is now false'
  );
  assert.ok(
    /onPress=\{\(\) => openInChat\('correct'\)\}/.test(card),
    'tapping an entry no longer opens the conversation'
  );
  return 'tapping an entry opens chat, as the prompt says';
});

check('an entry really cannot be moved to another day', () => {
  // happened_at appears in log-correction only as the column used to FIND an
  // entry. Nothing writes it. If that changes, the prompt must stop saying it
  // is impossible and start doing it.
  assert.ok(/happened_at/.test(correction), 'the correction module has changed shape entirely');
  assert.ok(
    !/set\s*\(\s*\{[^}]*happened_at/.test(correction),
    'a correction can now write happened_at, so the day CAN be moved and the prompt is wrong'
  );
  return 'happened_at is read to find an entry, never written to move one';
});

check('the prompt says there is no screen to send her to', () => {
  const p = REPLY_PROMPT_PARTS.INSIDE_THE_APP;
  assert.ok(/NEVER SEND THEM TO A SCREEN/.test(p), 'nothing forbids inventing a screen');
  assert.ok(/The Log has no editor at all/.test(p), 'the fact itself is not stated, only the ban');
  return 'the fact and the rule, in that order';
});

check('and it says what DOES work, not only what does not', () => {
  // A RULE WITH NO ALTERNATIVE IS A WISH. Last night's lesson, in the file it
  // came from: the model deflected to her GP because it had six figures and
  // nothing to compare them to. Forbidding the deflection would have changed
  // nothing. The same applies here.
  const p = REPLY_PROMPT_PARTS.INSIDE_THE_APP;
  assert.ok(/delete it, and log it again/i.test(p), 'the working alternative is not named');
  assert.ok(
    /Logging for a past day is ordinary/.test(p),
    'nothing tells it that backdated logging works, so it cannot offer the second step'
  );
  return 'delete, then log it again for the right day';
});

check('the rule reaches the model that actually writes the reply', () => {
  // THE FAULT THAT COST FOUR SITTINGS THIS WEEK. A block built and handed only
  // to the classify call is a block the reply never sees.
  const composed = replyPrompt({ voice: false });
  assert.ok(/NEVER SEND THEM TO A SCREEN/.test(composed), 'the rule is not in the composed prompt');
  const spoken = replyPrompt({ voice: true });
  assert.ok(/NEVER SEND THEM TO A SCREEN/.test(spoken), 'voice replies can still invent a screen');
  return 'typed and spoken';
});

check('and this check can fail', () => {
  const withoutRule = REPLY_PROMPT_PARTS.INSIDE_THE_APP.replace(/NEVER SEND THEM TO A SCREEN/, 'x');
  assert.ok(
    !/NEVER SEND THEM TO A SCREEN/.test(withoutRule),
    'the fixture did not change anything, so the assertions above test nothing'
  );
  // And the shipped reply she actually got would be caught by the same test.
  const herReply =
    "I don't have a way to move an entry's date from here - that'd need to happen in " +
    'the log itself, where you can edit the date on that entry directly.';
  assert.ok(
    /in the log itself|edit the date/.test(herReply),
    'the reply she received is not recognisable as the fault'
  );
  return 'the reply she got on 7 October is the fixture';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
