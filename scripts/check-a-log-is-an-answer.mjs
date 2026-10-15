// A LOG RESOLVES THE QUESTION, WHATEVER TIER IT DREW.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-log-is-an-answer.mjs
//
// When Selodia has asked the direct C-SSRS question - have you been wishing you
// were not here - it holds that question pending until the person engages. An
// off-topic turn preserves it rather than cancelling it, which is right for a
// chat turn and was wrong for a LOG, in two ways.
//
// IT WAS INCONSISTENT. Whether a log preserved or resolved the ladder turned on
// which tier the model happened to give it: a distress tier resolved, a neutral
// one preserved. And a training log lands on either side. "Did a 40 minute run
// this morning, felt hard" came back as ordinary_discouragement from BOTH Opus
// 5.5 and Sonnet 5 on 15 October 2026, while the rule's own comment assumed an
// activity log would be neutral. Same action, opposite behaviour, decided by a
// reading nobody ever saw.
//
// AND PRESERVING IT WAS THE WRONG DIRECTION. Ruth, rejecting the proposal to
// make a log always preserve the question: "if there was something wrong, a
// user would respond with a log. that's the behaviour of someone ignoring a
// silly safeguarding app." Somebody asked that question who replies by logging
// their lunch has answered it. Holding it open to ask again is the app she is
// describing, and SAFETY_PROMPT_BLOCK already says so: "Over-escalating is not
// the cautious option, it is a different way of getting it wrong."
//
// WHAT THIS DOES NOT TOUCH, and the checks below prove it: a genuine distress
// tier still cards and still escalates. Those branches run before this one.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { applySafetyStateMachine, DISTRESS_TIERS } = await import(root + '/app/lib/safety-classification.ts');

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

/** Mid-escalation: the direct question has been asked and is waiting. */
const WAITING = {
  previousEscalationStep: 'direct_asked',
  previousClassification: 'ambiguous_distress',
  previousRevisitCount: 0,
};

const turn = (classification, logIntent) =>
  applySafetyStateMachine({ classification, reply: 'ok', ...(logIntent ? { logIntent } : {}) }, WAITING);

console.log('\n  A LOG RESOLVES THE QUESTION\n');

check('a log resolves it whatever tier it drew', () => {
  // The point of the fix: these four used to behave in two different ways.
  for (const tier of ['neutral', 'ordinary_discouragement']) {
    for (const what of ['food', 'activity', 'measurement', 'sleep', 'hydration']) {
      const out = turn(tier, what);
      assert.strictEqual(
        out.nextEscalationStep,
        null,
        `a ${what} log classified ${tier} still holds the question open`
      );
    }
  }
  return '2 tiers x 5 kinds of log, all resolved';
});

check('a chat turn that logs nothing still preserves it', () => {
  // The original rule, untouched: an off-topic SENTENCE is not an answer.
  for (const logIntent of [undefined, 'none', '']) {
    const out = turn('neutral', logIntent);
    assert.strictEqual(
      out.nextEscalationStep,
      'direct_asked',
      `a neutral turn with logIntent ${JSON.stringify(logIntent)} cancelled the question`
    );
  }
  return 'neutral, none and missing all preserve';
});

check('an engaged answer still resolves it, as it always did', () => {
  const out = turn('ordinary_discouragement', undefined);
  assert.strictEqual(out.nextEscalationStep, null, 'an engaged "I am fine, just tired" no longer resolves');
  return 'ordinary_discouragement resolves';
});

check('and a real disclosure is untouched by any of this', () => {
  // THE THING THAT MUST NOT BREAK. A log alongside genuine distress must still
  // card and still be treated as the distress tier it is.
  const crisis = applySafetyStateMachine(
    { classification: 'acute_crisis', reply: 'ok', logIntent: 'food' },
    { previousEscalationStep: 'direct_asked', previousClassification: 'ambiguous_distress', previousRevisitCount: 0 }
  );
  assert.ok(crisis.resourceCard, 'an acute crisis stopped carding because the turn also logged food');
  assert.strictEqual(crisis.resourceCard.org, 'Shout');

  const eating = applySafetyStateMachine(
    { classification: 'eating_related_distress', reply: 'ok', logIntent: 'food' },
    { previousEscalationStep: null, previousClassification: null, previousRevisitCount: 0 }
  );
  assert.ok(eating.resourceCard, 'eating distress stopped carding because the turn also logged food');
  assert.strictEqual(eating.resourceCard.org, 'Beat');
  return 'crisis and eating distress still card, log or no log';
});

check('ambiguous distress still escalates even on a logging turn', () => {
  const out = applySafetyStateMachine(
    { classification: 'ambiguous_distress', reply: 'ok', logIntent: 'food' },
    { previousEscalationStep: null, previousClassification: null, previousRevisitCount: 0 }
  );
  assert.notStrictEqual(out.nextEscalationStep, null, 'ambiguous distress stopped escalating on a logging turn');
  return `escalates to ${out.nextEscalationStep}`;
});

check('and this check can fail', () => {
  // THE OLD RULE: preserve whenever the tier is not a distress tier, with no
  // regard to whether anything was logged.
  const oldWouldPreserve = (classification) => !DISTRESS_TIERS.includes(classification);
  assert.strictEqual(oldWouldPreserve('neutral'), true, 'the old rule reads as already fixed');
  // Which is the inconsistency: the same food log, two answers.
  assert.strictEqual(oldWouldPreserve('ordinary_discouragement'), false);
  assert.notStrictEqual(
    oldWouldPreserve('neutral'),
    oldWouldPreserve('ordinary_discouragement'),
    'the two tiers agreed under the old rule, so there was nothing to fix'
  );
  return 'one action, two outcomes, under the old rule';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
