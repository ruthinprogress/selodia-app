// Does the unsafe-goal assessment draw the line where it should, and refuse to
// guess where it cannot know?
//
// Item 43 is a safety item and the repository has no test suite (Part Four), so
// this is a runnable probe. Everything here is pure arithmetic - no API calls, no
// cost - which is itself the point of the design: the model reports the number
// and this decides, so the deciding can be checked exactly.
//
//   npx tsx scripts/probe-goal-safety.mjs

import {
  assessGoalWeight,
  bmiFor,
  goalSafetyPrompt,
  shouldOfferResource,
  UNSAFE_GOAL_STANDING_BLOCK,
  UNSAFE_GOAL_TURN_BLOCK,
} from '../app/lib/goal-safety.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

console.log('\n  WHERE THE LINE FALLS (height 165cm unless stated)\n');
const at165 = (kg) => assessGoalWeight(kg, 165);
console.log(`    for reference: 45kg=${bmiFor(45, 165).toFixed(1)}  50kg=${bmiFor(50, 165).toFixed(1)}  51kg=${bmiFor(51, 165).toFixed(1)}  60kg=${bmiFor(60, 165).toFixed(1)}\n`);

check('45kg is unsafe', at165(45).verdict, 'unsafe');
// 16.5 — under the 18.5 floor but above the severe-thinness line at 16, so this
// is correctly NOT severe. The first version of this probe asserted otherwise,
// and the probe was wrong rather than the code.
check('45kg is unsafe but NOT severe (bmi 16.5)', at165(45).severe, false);
check('42kg IS severe (bmi 15.4)', at165(42).severe, true);
check('50kg is unsafe (just under 18.5)', at165(50).verdict, 'unsafe');
check('50kg is NOT severe', at165(50).severe, false);
check('51kg is safe', at165(51).verdict, 'safe');
check('60kg is safe', at165(60).verdict, 'safe');
// 8 stone, the way somebody would actually say it, on a shorter frame.
check('50.8kg at 155cm is safe', assessGoalWeight(50.8, 155).verdict, 'safe');
check('50.8kg at 180cm is unsafe', assessGoalWeight(50.8, 180).verdict, 'unsafe');

console.log('\n  REFUSING TO GUESS\n');
check('no height means unknown, never safe', assessGoalWeight(45, null).verdict, 'unknown');
check('  and says why', assessGoalWeight(45, null).reason, 'no-height');
check('no goal means unknown', assessGoalWeight(null, 165).verdict, 'unknown');
check('zero height is not a height', assessGoalWeight(45, 0).verdict, 'unknown');
check('negative goal is not a goal', assessGoalWeight(-5, 165).verdict, 'unknown');
check('NaN is not a number', assessGoalWeight(Number.NaN, 165).verdict, 'unknown');

console.log('\n  THE RESOURCE GOES OUT ONCE, EVER\n');
check('unsafe and never flagged: offer it', shouldOfferResource(at165(45), null), true);
check('unsafe but already flagged: do not', shouldOfferResource(at165(45), '2026-09-01T00:00:00Z'), false);
check('safe goal: never', shouldOfferResource(at165(60), null), false);
check('unknown: never', shouldOfferResource(assessGoalWeight(45, null), null), false);

console.log('\n  WHICH INSTRUCTION THE MODEL GETS\n');
check('unsafe now: the turn block', goalSafetyPrompt(at165(45), null) === UNSAFE_GOAL_TURN_BLOCK, true);
check('unsafe now, flagged before: still the turn block', goalSafetyPrompt(at165(45), '2026-09-01T00:00:00Z') === UNSAFE_GOAL_TURN_BLOCK, true);
check('flagged before, nothing said now: standing block', goalSafetyPrompt(assessGoalWeight(null, 165), '2026-09-01T00:00:00Z') === UNSAFE_GOAL_STANDING_BLOCK, true);
check('never flagged, ordinary turn: no block at all', goalSafetyPrompt(assessGoalWeight(null, 165), null), '');
check('safe goal stated, never flagged: no block', goalSafetyPrompt(at165(60), null), '');

console.log('\n  THE BLOCKS SAY WHAT THEY MUST\n');
const both = UNSAFE_GOAL_TURN_BLOCK + UNSAFE_GOAL_STANDING_BLOCK;
// The blocks may NAME bmi in order to forbid showing one — what must never appear
// is an actual figure, or a threshold the person could measure themselves against.
// Testing for the word alone flagged the prohibition itself, which is the opposite
// of the thing being guarded.
check('no numeric figure anywhere', /\b\d{2}\.\d\b/.test(both), false);
check('no threshold quoted at the person', /18\.5|\bbody mass index\b/i.test(both), false);
check('neither uses a category word at the person', /\bunderweight\b/i.test(both), false);
check('turn block protects logging explicitly', /logging is completely unaffected/i.test(UNSAFE_GOAL_TURN_BLOCK), true);
check('standing block forbids re-raising it', /must not be raised again/i.test(UNSAFE_GOAL_STANDING_BLOCK), true);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
