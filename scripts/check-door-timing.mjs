// THE CLOCK STARTS AT THE DOOR, NOT IN THE PIPELINE.
//
//   node scripts/check-door-timing.mjs
//
// 9 October 2026. A spoken turn reported total: 4097 and spokenAloudFrom: 2114
// in turn_diagnostics, while ElevenLabs measured first byte at 14,370ms. Twelve
// seconds happened in the adapter, which had no clock at all.
//
// Where they went: two sequential reads of chat_messages to decide whether the
// turn had been seen before, then up to SUPERSEDE_WAIT_MS - ten seconds - of
// deliberately waiting for an earlier turn to finish. Ten plus four point one
// is fourteen point one, which matches the observed gap to three tenths of a
// second.
//
// SO EVERY DIAGNOSTIC IN THE APP AGREED VOICE WAS FAST WHILE SHE SAT WAITING.
// That is the fault this check exists for, and it is not "the adapter is slow",
// it is "the instrument was pointed at the fast part". A timer that does not
// cover the waiting is worse than no timer, because its numbers get quoted.
//
// This asserts the marks exist and bracket the two waits. It cannot assert what
// they measure at runtime, so it is deliberately narrow: it fails if somebody
// removes a mark, moves the clock's start, or adds a new wait without one.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const ADAPTER = 'app/v1/chat/completions/route.ts';
const DIAG = 'app/lib/turn-diagnostics.ts';

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

const src = readFileSync(ADAPTER, 'utf8');
// Comments quote the code they replaced, so a check reading them finds its own
// explanation and passes. Same lesson as check-ask-about-this.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n  THE CLOCK STARTS AT THE DOOR\n');

check('the clock starts before anything is read', () => {
  const post = code.indexOf('export async function POST');
  assert.ok(post > 0, 'POST has moved');
  const timer = code.indexOf('doorTimer()', post);
  const firstRead = code.indexOf('await request.json()', post);
  assert.ok(timer > 0, 'the door timer is gone');
  assert.ok(
    timer < firstRead,
    'the clock starts after the body is read, so it misses the arrival'
  );
  return 'before the body is parsed';
});

check('both of the waits are bracketed', () => {
  // The ten second one. If it is not marked on both sides, the wait vanishes
  // into a gap between two other marks and cannot be told from slow work.
  assert.ok(/door\.mark\('waitingForEarlierTurn'\)/.test(code), 'the supersede wait has no start mark');
  assert.ok(/door\.mark\('earlierTurnSettled'\)/.test(code), 'the supersede wait has no end mark');
  const a = code.indexOf("door.mark('waitingForEarlierTurn')");
  const b = code.indexOf("door.mark('earlierTurnSettled')");
  const waitCall = code.indexOf('answerAfter(db, since, SUPERSEDE_WAIT_MS)');
  assert.ok(a < waitCall && waitCall < b, 'the marks do not surround the wait');
  // And the twenty second replay path.
  assert.ok(/door\.mark\('replayingEarlierAnswer'\)/.test(code), 'the replay path is unmarked');
  return 'the 10s supersede wait and the 20s replay';
});

check('every wait in the file has a mark near it', () => {
  // The regression that matters: a THIRD wait added later with no mark, which
  // would be invisible in exactly the way the first two were.
  // CALL SITES, NOT THE DECLARATION. The first version of this matched
  // `async function answerAfter(...)` on line 469 and reported it as an
  // unmarked wait, which is a check failing on correct code - the exact thing
  // check-me-sections did this morning with a fixed source window.
  const waits = [...code.matchAll(/(?<!function )answerAfter\(db,[^)]*\)/g)].map((m) => m.index);
  assert.ok(waits.length >= 2, `only ${waits.length} wait(s) found - has answerAfter been renamed?`);
  for (const at of waits) {
    const around = code.slice(Math.max(0, at - 400), at + 200);
    assert.ok(/door\.mark\(/.test(around), `a wait at ${at} has no timing mark near it`);
  }
  return `${waits.length} waits, all marked`;
});

check('the handover to the pipeline is marked, and is the last thing', () => {
  assert.ok(/door\.mark\('pipelineStarted'\)/.test(code), 'the handover is unmarked');
  const mark = code.indexOf("door.mark('pipelineStarted')");
  const call = code.indexOf('askSelodia(inner)');
  assert.ok(mark < call, 'the mark is after the pipeline is already running');
  assert.ok(/door\.mark\('turnChecked'\)/.test(code), 'the chat_messages reads are unmarked');
  return 'turnChecked, then pipelineStarted';
});

check('recording cannot cost the turn it measures', () => {
  // The whole point of after() in turn-diagnostics: a timer that makes the
  // thing slower is not a measurement, it is a change.
  assert.ok(/void run\.then\(/.test(code), 'the recording is awaited on the reply path');
  const diag = readFileSync(DIAG, 'utf8');
  const at = diag.indexOf('export function recordAdapterTiming');
  assert.ok(at > 0, 'recordAdapterTiming is gone');
  assert.ok(/function write\(/.test(diag) && /after\(work\)/.test(diag), 'write no longer defers');
  return 'not awaited, and written inside after()';
});

check('it is written under its own label, beside the pipeline row', () => {
  const diag = readFileSync(DIAG, 'utf8');
  const block = diag.slice(diag.indexOf('export function recordAdapterTiming'));
  assert.ok(/label: 'adapter'/.test(block), "the adapter row is not labelled 'adapter'");
  // And the pipeline's own row must keep its label, so the two can be joined.
  assert.ok(/label: t\.voice \? 'voice' : 'typed'/.test(diag), 'the pipeline row label has changed');
  return "'adapter' beside 'voice'";
});

check('and this check can fail', () => {
  // Every assertion above is "this string is present". Prove the absent case is
  // detected, using the file as it was this morning: no timer, no marks.
  const asShipped = "export async function POST(request: NextRequest) {\n  let body;\n  body = await request.json();";
  assert.ok(!/doorTimer\(\)/.test(asShipped), 'the unmeasured version is not detected as unmeasured');
  assert.ok(!/door\.mark\(/.test(asShipped), 'the unmarked version is not detected as unmarked');
  // And the live file really does differ from it.
  assert.ok(/doorTimer\(\)/.test(code) && /door\.mark\(/.test(code), 'the live file has no clock');
  return 'this morning’s version would fail every check above';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
