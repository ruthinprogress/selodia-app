// A CORRECTION EITHER HAPPENS OR SAYS IT DID NOT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-correction-is-never-silent.mjs
//
// Ruth, 14 October 2026, running her own examples through the chat: she
// corrected a meal she had just logged and nothing changed. Twice in one run,
// and on BOTH chats, so it was not the new one. Called directly four times, two
// came back as "Unterminated string in JSON at position 1097".
//
// THREE THINGS WENT WRONG AT ONCE, and each is held here:
//
//   1. The correction parse was capped at 500 tokens while the parse it mirrors
//      had 8000. A whole corrected entry with its items does not fit in 500, so
//      the JSON arrived half-written. The cap on the other branch had already
//      been raised from 500 on 9 September for the identical reason.
//   2. Nothing checked whether the answer was cut off, so a truncated reply went
//      to JSON.parse and surfaced as a parse error about a character position.
//   3. The route caught that and logged it to a console with no retention,
//      saying NOTHING to her. The entry kept its old numbers and she was told
//      only by the generic line that fires when the model happens to claim a
//      change. A change she asked for and did not get must always be said.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const food = readFileSync('app/lib/food-logging.ts', 'utf8').split('\r\n').join('\n');
const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\r\n').join('\n');

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

console.log('\n  A CORRECTION EITHER HAPPENS OR SAYS IT DID NOT\n');

check('the correction parse has room for a whole entry', () => {
  const m = food.match(/max_tokens: updateLogId \? (\d+) : (\d+),/);
  assert.ok(m, 'the two token caps are no longer written where this can read them');
  const [, correction, parse] = m.map(Number);
  assert.ok(
    correction >= 1500,
    `a correction gets ${correction} tokens, which is what cut the JSON in half at 500`
  );
  assert.ok(parse >= correction, 'the full parse now has less room than a single correction');
  return `${correction} for a correction, ${parse} for a parse`;
});

check('a cut-off answer is caught before anything tries to read it', () => {
  const guard = food.indexOf("message.stop_reason === 'max_tokens'");
  assert.ok(guard > 0, 'nothing checks whether the answer was cut off');
  const firstParse = food.indexOf('JSON.parse(cleaned)');
  assert.ok(firstParse > 0, 'the parse has moved and this check no longer guards it');
  assert.ok(
    guard < firstParse,
    'the truncation check runs after the parse, so a half-written answer still throws a parse error'
  );
  return 'checked, then parsed';
});

check('a correction that fails tells her so', () => {
  const at = route.indexOf("console.log('ASK-SELODIA CORRECTION FAILED:'");
  assert.ok(at > 0, 'the correction catch has moved');
  const block = route.slice(at, at + 400);
  assert.ok(/correctionNote =/.test(block), 'a failed correction still says nothing to her');
  assert.ok(
    /didn't go through|did not go through/.test(block),
    'the note does not say the change did not happen'
  );
  // And it must not claim the entry changed.
  assert.ok(!/updated|corrected to/.test(block.split('correctionNote =')[1] ?? ''), 'the note implies something changed');
  return 'said plainly, with an offer to try again';
});

check('and this check can fail', () => {
  // The three shapes that were there this morning.
  const oldCap = 'max_tokens: updateLogId ? 500 : 8000,';
  const m = oldCap.match(/max_tokens: updateLogId \? (\d+) : (\d+),/);
  assert.ok(Number(m[1]) < 1500, 'the old 500 cap reads as roomy');
  const oldFood = "const responseText = message.content[0].type === 'text' ? message.content[0].text : '';";
  assert.ok(!/stop_reason/.test(oldFood), 'the old unguarded parse reads as guarded');
  const oldCatch = "} catch (err) {\n      console.log('ASK-SELODIA CORRECTION FAILED:', err);\n    }";
  assert.ok(!/correctionNote =/.test(oldCatch), 'the old silent catch reads as speaking');
  return 'the 500 cap, the unguarded parse and the silent catch all fail';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
