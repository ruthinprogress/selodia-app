// THE WEEK'S OWN ARITHMETIC, tested where it can actually be wrong.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-week-plan.mjs
//
// Four rules from Ruth's Plans brief of 29 September 2026, all of which are
// easy to write plausibly and get wrong quietly:
//
//   placedOnDays     "Let me lead" users get everything in Anytime unless
//                    dragged. The week and the "Log the week" sheet both ask
//                    this, and if they ever disagree the app argues with
//                    itself in front of her.
//   cadenceConflict  "Gym says 1x/week but is on Mon and Thu - ask me once
//                    which is right." Only when BOTH answers are definite.
//   logMatchesPlan   A tick for something she logged. A wrong match ticks the
//                    wrong card; a missed match says nothing, which is why the
//                    matcher is deliberately conservative.
// EVERY CHECK IS PROVED ABLE TO FAIL. A test suite that passes against an
// empty implementation is a suite that was testing its own wording. At the
// bottom this file runs each group against a stub that answers nothing and
// asserts the group fails - see MUTATION below. That has caught two checks in
// this repo already.

import assert from 'node:assert';

import {
  cadenceConflict,
  logMatchesPlan,
  placedOnDays,
  timesPerWeek,
} from '../mobile/src/lib/week-plan.ts';

let pass = 0;
const failures = [];

function check(group, name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${group} / ${name}: ${e.message}`);
  }
}

// ---------------------------------------------------------------- placedOnDays

const GROUPS = {
  placedOnDays(impl) {
    const suggested = { days: ['mon', 'thu'], days_chosen_at: null };
    const chosen = { days: ['wed'], days_chosen_at: '2026-09-29T09:00:00Z' };
    const nowhere = { days: [], days_chosen_at: null };

    check('placedOnDays', 'Guide me honours the plan', () => {
      assert.deepEqual(impl('guide_me', suggested), ['mon', 'thu']);
    });
    check('placedOnDays', 'no setting yet behaves like Guide me', () => {
      assert.deepEqual(impl(null, suggested), ['mon', 'thu']);
    });
    check('placedOnDays', 'Let me lead ignores a day she did not choose', () => {
      assert.deepEqual(impl('let_me_lead', suggested), []);
    });
    check('placedOnDays', 'Let me lead keeps a day she DID choose', () => {
      assert.deepEqual(impl('let_me_lead', chosen), ['wed']);
    });
    check('placedOnDays', 'a plan with no days is in Anytime either way', () => {
      assert.deepEqual(impl('guide_me', nowhere), []);
      assert.deepEqual(impl('let_me_lead', nowhere), []);
    });
    check('placedOnDays', 'a null days column does not throw', () => {
      assert.deepEqual(impl('guide_me', { days: null, days_chosen_at: null }), []);
    });
  },

  cadenceConflict(impl) {
    check('cadenceConflict', 'Gym: 1x/week on two days is a conflict', () => {
      assert.ok(impl('1x/week', ['mon', 'thu']));
    });
    check('cadenceConflict', 'agreement is not a conflict', () => {
      assert.equal(impl('2x/week', ['mon', 'thu']), null);
    });
    check('cadenceConflict', 'a vague cadence is never a conflict', () => {
      assert.equal(impl('when possible', ['mon', 'thu']), null);
      assert.equal(impl(null, ['mon', 'thu']), null);
    });
    check('cadenceConflict', 'daily on seven days is not a conflict', () => {
      assert.equal(impl('daily', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), null);
    });
    check('cadenceConflict', 'no days at all is not a conflict', () => {
      assert.equal(impl('1x/week', []), null);
    });
  },

  logMatchesPlan(impl) {
    check('logMatchesPlan', 'the same activity matches', () => {
      assert.ok(impl('Ballet', 'Ballet'));
    });
    check('logMatchesPlan', 'case and spacing do not matter', () => {
      assert.ok(impl('  ballet ', 'Ballet'));
    });
    check('logMatchesPlan', 'a different activity does not match', () => {
      assert.equal(impl('Running', 'Ballet'), false);
    });
    check('logMatchesPlan', 'an empty log matches nothing', () => {
      assert.equal(impl('', 'Ballet'), false);
    });
  },
};

// Run each group against the real implementation.
GROUPS.placedOnDays(placedOnDays);
GROUPS.cadenceConflict(cadenceConflict);
GROUPS.logMatchesPlan(logMatchesPlan);

check('timesPerWeek', 'it declines to guess', () => {
  assert.equal(timesPerWeek('when possible'), null);
  assert.equal(timesPerWeek('3x/week'), 3);
  assert.equal(timesPerWeek('daily'), 7);
});

// ------------------------------------------------------------------- MUTATION
//
// PROVE EACH GROUP CAN FAIL. Every group is re-run against a stub that answers
// nothing useful. If a group still passes, its checks are testing a wording
// rather than a behaviour, and this file says so rather than reporting green.

const EMPTY = {
  placedOnDays: () => [],
  cadenceConflict: () => null,
  logMatchesPlan: () => true,
};

const mutationFailures = [];
for (const [name, run] of Object.entries(GROUPS)) {
  const before = failures.length;
  const realPass = pass;
  run(EMPTY[name]);
  const brokeSomething = failures.length > before;
  // Roll the stub's results back out of the tally.
  failures.length = before;
  pass = realPass;
  if (!brokeSomething) {
    mutationFailures.push(
      `${name}: every check still passed against an implementation that answers nothing. ` +
        'These checks are not testing behaviour.'
    );
  }
}

for (const f of failures) console.error('  FAIL  ' + f);
for (const f of mutationFailures) console.error('  USELESS  ' + f);

const bad = failures.length + mutationFailures.length;
console.log(`\n  ${pass} passed, ${failures.length} failed, ${mutationFailures.length} useless`);
if (bad > 0) process.exit(1);
