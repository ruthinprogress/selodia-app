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

    // THE TWO MODES WENT ON 21 OCTOBER 2026 and the plan is always honoured.
    // "Guide me" had been taken out of onboarding weeks earlier and moved to a
    // Settings screen that was never linked, so the stored value was null for
    // everybody and the "Let me lead" branch was unreachable. Ruth: "I think
    // maybe we scrap those two modes as a new user might not know what it
    // means and will lose functionality before even seeing it."
    //
    // What is left is what everybody already had.
    check('placedOnDays', 'a card sits on the days its plan names', () => {
      assert.deepEqual(impl(suggested), ['mon', 'thu']);
    });
    check('placedOnDays', 'a day she chose herself is honoured the same way', () => {
      assert.deepEqual(impl(chosen), ['wed']);
    });
    check('placedOnDays', 'a plan with no days is in Anytime', () => {
      assert.deepEqual(impl(nowhere), []);
    });
    check('placedOnDays', 'a null days column does not throw', () => {
      assert.deepEqual(impl({ days: null, days_chosen_at: null }), []);
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
