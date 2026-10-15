// A LED TURN DOES NOT PAY FOR THE SAME PREFIX TWICE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-prefix-is-read-once.mjs
//
// Ruth, 15 October 2026: "latency next".
//
// WHERE THE TIME GOES, measured from her own turns before anything was
// changed: 185 typed turns in a week, 13.6s average, 28.5s worst. Of a 17.0s
// turn, 15.5s is the two model calls and 1.2s is everything else put together
// - auth, context, day state, prompt build, every database write. There is
// nothing to win outside the calls.
//
// The knobs were already at their stops. Effort is 'low' and the SDK has no
// level below it. Opus 5.5 refuses thinking.type.disabled outright - the API
// answers "not supported for this model, use thinking.type.adaptive and
// output_config.effort". The discarded fallback reply is already asked for
// short, and measured at 114 tokens rather than the 554 a wrongly-built probe
// suggested.
//
// What was left was that a led turn sends the same prefix TWICE. The reply
// step spreads the first call's messages and appends to them, and only three
// of the four available cache breakpoints were in use, so everything after
// personContext arrived fresh both times - this turn's state, her week, the
// conversation itself. 8,675 input tokens on her slow turns, paid twice.
//
// MEASURED, three runs an arm (scripts/probe-cache-reuse.mjs):
//
//   three breakpoints   first 3.7s   reply 3.7s   turn 7.4s   8,410 fresh
//   four breakpoints    first 3.7s   reply 2.2s   turn 5.9s     270 fresh
//
// The first call is unchanged, which is the point: this buys the reply step
// its prefix back and costs the first step nothing but a cache write.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
const lead = readFileSync('app/lib/lead-turn.ts', 'utf8');

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

console.log('\n  THE PREFIX IS READ ONCE\n');

check('four breakpoints, which is the limit', () => {
  const breakpoints = route.match(/cache_control: \{ type: 'ephemeral' \}/g) ?? [];
  assert.strictEqual(
    breakpoints.length,
    4,
    `found ${breakpoints.length} breakpoints in the route; the API allows at most 4`
  );
  return 'tools, static prompt, her context, the last message';
});

check('the fourth is on the last message', () => {
  assert.ok(
    /messages\[messages\.length - 1\] = \{ role: last\.role, content: blocks \};/.test(route),
    'the last message is not being replaced with a marked copy'
  );
  assert.ok(
    /blocks\[blocks\.length - 1\] = \{ \.\.\.tail, cache_control: \{ type: 'ephemeral' \} \};/.test(route),
    'the breakpoint is not on the final content block'
  );
  return 'the whole prefix sits behind it';
});

check('and only on a led turn', () => {
  // On the one-call path nothing re-reads the prefix and the last message is
  // her newest one, so the cache would be written every turn and never read.
  assert.ok(
    /if \(leadMode && messages\.length > 0\) \{/.test(route),
    'the fourth breakpoint is not gated on leadMode'
  );
  return 'the one-call path is not charged for a cache nobody reads';
});

check('an empty last message is left unmarked', () => {
  // A text block with no text is rejected by the API, and a turn that cannot
  // be marked must go without rather than fail.
  assert.ok(
    /last\.content\.length > 0/.test(route),
    'an empty string message would be turned into an empty text block'
  );
  assert.ok(
    /tail && \(tail\.type === 'text' \|\| tail\.type === 'image'\)/.test(route),
    'the breakpoint is not restricted to blocks that can carry one'
  );
  return 'no empty block, and only text or image';
});

check('it is placed after the photo is attached', () => {
  // The last user message is rewritten when a photo comes with the turn. Mark
  // it before that and the mark is thrown away with the string it sat on.
  const photo = route.indexOf('if (pendingCard) {');
  const mark = route.indexOf('if (leadMode && messages.length > 0) {');
  assert.ok(photo > 0 && mark > 0, 'could not find both blocks');
  assert.ok(mark > photo, 'the breakpoint is set before the photo rewrites the message');
  return 'the mark survives a photo turn';
});

check('the reply step still sends the same prefix', () => {
  // The whole saving rests on this: if the reply step ever stops spreading the
  // first call's messages, the cache it is reusing is gone.
  assert.ok(/\.\.\.req\.first\.messages,/.test(lead), 'the reply step no longer continues the first call');
  assert.ok(/system: req\.first\.system,/.test(lead), 'the reply step no longer sends the same system');
  assert.ok(/tools: req\.first\.tools,/.test(lead), 'the reply step no longer sends the same tools');
  return 'system, tools and messages all reused';
});

check('the effort is the same on both calls, so the cache survives', () => {
  // The resolved effort is rendered into the prompt. Changing it between the
  // two calls would throw away the cache this whole check is about.
  const uses = lead.match(/output_config: \{ effort: LEAD_EFFORT \}/g) ?? [];
  assert.ok(uses.length >= 1, 'the reply step is not pinned to LEAD_EFFORT');
  assert.ok(/output_config: \{ effort: LEAD_EFFORT \}/.test(route), 'the first call is not pinned to LEAD_EFFORT');
  return 'one effort, both calls';
});

check('and this check can fail', () => {
  // The weaker version of this check: "there is a cache_control somewhere".
  // That passed throughout the months when the reply step was re-reading 8,675
  // tokens on every turn, which is the whole thing being fixed.
  assert.ok(/cache_control/.test(route), 'the route has no caching at all');
  const breakpoints = (route.match(/cache_control: \{ type: 'ephemeral' \}/g) ?? []).length;
  assert.notStrictEqual(breakpoints, 3, 'the route is back to three breakpoints and this check would still pass');
  return 'presence of caching proves nothing; the count and the placement do';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
