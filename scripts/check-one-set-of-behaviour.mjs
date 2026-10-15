// A SPOKEN TURN AND A TYPED TURN BEHAVE THE SAME WAY.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-one-set-of-behaviour.mjs
//
// FOUND 14 OCTOBER 2026, scoping what "voice runs the old architecture" meant
// in practice. The answer was worse than expected: of the eight behaviour rules
// agreed during that day's walkthrough, the number reaching a spoken turn was
// ZERO. Not few. None.
//
// So the mode where somebody cannot skim, cannot scroll back and most needs a
// crisp answer was the one giving the older, weaker advice - and every
// improvement to the typed path widened the gap.
//
// THE FIX IS A SHARED CORE WITH A THIN LAYER PER MEDIUM, which is also what the
// literature settles on: separate branches per modality is what you build before
// you notice you are maintaining two of everything. What is shared is WHAT TO
// SAY. What is not is how it is rendered - labels and bullet lists for a screen,
// one thought per turn for a speaker.
//
// This holds the split. It does not check that the rules are good; it checks
// that neither path can quietly stop having them.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { REPLY_CORE } = await import(root + '/app/lib/reply-core.ts');
const { LEAD_REPLY_INSTRUCTIONS } = await import(root + '/app/lib/lead-turn.ts');
const { replyPrompt, REPLY_PROMPT_PARTS } = await import(root + '/app/lib/reply-prompt.ts');

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

/** The behaviour that must reach a person however they are talking to the app. */
const SHARED = [
  ['knows their history', /BE THE ONE WHO KNOWS THEIR HISTORY/],
  ['gives the first step rather than a list', /GIVE THEM THE FIRST STEP, NOT THE LIST/],
  ['does not assume the step is easy', /DO NOT ASSUME THE STEP IS EASY/],
  ['offers to look at where they got stuck', /send me a screenshot/],
  ['names the test, not the topic', /NAME THE TEST, NOT THE TOPIC/],
  ['names the artefact that opens the route', /THE ARTEFACT IS THE ROUTE/],
  ['knows what a form question is really asking', /KNOW WHAT A QUESTION IS FOR/],
  ['answers from the whole record', /ANSWER FROM THE WHOLE RECORD/],
  ['and everything handed over is true and on file', /TRUE AND IN THEIR RECORD/],
];

console.log('\n  ONE SET OF BEHAVIOUR, TWO WAYS OF SPEAKING IT\n');

check('the core holds every shared rule', () => {
  for (const [what, pattern] of SHARED) {
    assert.ok(pattern.test(REPLY_CORE), `the core no longer ${what}`);
  }
  return `${SHARED.length} rules`;
});

check('a typed turn gets all of them', () => {
  for (const [what, pattern] of SHARED) {
    assert.ok(pattern.test(LEAD_REPLY_INSTRUCTIONS), `a typed reply no longer ${what}`);
  }
  // And by reference rather than by copy, or they drift the first time one changes.
  const src = readFileSync('app/lib/lead-turn.ts', 'utf8');
  assert.ok(/\$\{REPLY_CORE\}/.test(src), 'the led path has its own copy of the core again');
  return 'via REPLY_CORE';
});

check('a spoken turn gets all of them too, which is the whole point', () => {
  const spoken = replyPrompt({ voice: true });
  for (const [what, pattern] of SHARED) {
    assert.ok(pattern.test(spoken), `a spoken reply no longer ${what}`);
  }
  return `${SHARED.length} rules, spoken`;
});

check('and a typed turn on the old path gets them as well', () => {
  // The old path still serves anybody without the led chat switched on, and a
  // rule that only reaches two of the three ways through is still a divergence.
  const typedOld = replyPrompt({ voice: false });
  for (const [what, pattern] of SHARED) {
    assert.ok(pattern.test(typedOld), `the old typed path no longer ${what}`);
  }
  return 'all three ways through';
});

check('what is medium-specific stays medium-specific', () => {
  // The written shape belongs to the screen and must NOT be in the core, or a
  // spoken reply starts reading bullet labels aloud.
  assert.ok(/double asterisks/.test(LEAD_REPLY_INSTRUCTIONS), 'the written shape has left the typed path');
  assert.ok(!/double asterisks/.test(REPLY_CORE), 'the core tells a spoken reply to draw labels');
  assert.ok(!/No tables/.test(REPLY_CORE), 'the core carries a screen-only rule');
  // And the spoken rules stay with the speaker.
  assert.ok(/SPOKEN ALOUD/.test(REPLY_PROMPT_PARTS.VOICE), 'the voice layer is gone');
  assert.ok(!/SPOKEN ALOUD/.test(REPLY_CORE), 'the core assumes a speaker');
  return 'shape on the screen, one thought per turn on the speaker';
});

check('the voice path kept what it already had', () => {
  // ADDED, NOT SWAPPED IN. A refactor that removes working rules from the half
  // that cannot easily be tested is a bet, not a refactor.
  const spoken = replyPrompt({ voice: true });
  for (const part of ['BASELINE', 'SAVES', 'NOT_A_DOCTOR', 'NEVER_SCOLD', 'NOT_FOR_PREGNANCY']) {
    const text = REPLY_PROMPT_PARTS[part];
    assert.ok(spoken.includes(text), `${part} was dropped from the spoken prompt`);
  }
  return '5 of the old parts spot-checked, all present';
});

check('and this check can fail', () => {
  // THE STATE ON 14 OCTOBER: the spoken prompt with no core in it.
  const before = [REPLY_PROMPT_PARTS.BASELINE, REPLY_PROMPT_PARTS.VOICE].join('\n\n');
  const reached = SHARED.filter(([, pattern]) => pattern.test(before)).length;
  assert.strictEqual(reached, 0, `${reached} rules reached the old spoken prompt, so the gap was smaller than recorded`);
  return 'zero of the nine reached a spoken turn before this';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
