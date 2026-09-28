// A SAVED PLAN SHE SAYS SHE DID IS A SESSION, NOT AN ACTIVITY ROW.
//
// Ruth's item 8. She found "Full-Body Barbell Strength Plan" in Movement as an
// ACTIVITY whose type was the plan's own name: the plan's history did not move
// on, its movements never reached the week, and the flower got nothing.
//
// The session writer exists and is correct. It was never reached, because the
// classifier set logIntent 'activity' instead of workoutPlan - the thigh failure
// in a different tab. The guard now sits at the write, and this tests the thing
// the guard depends on: that choosePlan is strict enough to be trusted there.
//
// Pure. No model, no database.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-plan-as-session.mjs

import { choosePlan } from '../app/lib/workout-session.ts';

// Her real library, from the duplicate-merge on 19 September.
const PLANS = [
  { id: '1', title: 'Full-Body Barbell Strength Plan' },
  { id: '2', title: 'Inner Thigh Routine' },
  { id: '3', title: 'Side Splits Program' },
];

const ONE_PLAN = [{ id: '1', title: 'Full-Body Barbell Strength Plan' }];

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

console.log('\n## What must become a session\n');

check(
  'the exact title, which is what she actually saw logged as an activity',
  choosePlan('Full-Body Barbell Strength Plan', PLANS)?.id === '1'
);
check('the title in a sentence', choosePlan('did my Full-Body Barbell Strength Plan today', PLANS)?.id === '1');
check('a distinctive part of it', choosePlan('inner thigh routine this morning', PLANS)?.id === '2');
check('case and spacing do not matter', choosePlan('  side splits program  ', PLANS)?.id === '3');
// THE TWO CALLERS ARE NOT THE SAME. The deliberate path runs after the model has
// decided she said she did a routine; the guard runs on text that was heading for
// an activity row, where nothing has decided that. So the guard requires words
// from the plan's own title and the deliberate path does not.
check(
  'the guard does NOT turn an ordinary run into a session for a one-plan user',
  choosePlan('went for a 5k run', ONE_PLAN, { requireNameOverlap: true }) === null
);
check(
  'nor a bare "my workout", which names no plan',
  choosePlan('did my workout today', ONE_PLAN, { requireNameOverlap: true }) === null
);
check(
  'but the title still matches under the strict rule',
  choosePlan('did the Full-Body Barbell Strength Plan', ONE_PLAN, { requireNameOverlap: true })?.id === '1'
);

console.log('\n## What must NOT, because a wrong routine is worse than none\n');

check('an ordinary run', choosePlan('went for a 5k run', PLANS) === null);
check('a gym session that names no plan', choosePlan('an hour at the gym', PLANS) === null);
// THE TIE. "Thigh" and "splits" both appear; neither wins, so nothing is written.
check(
  'a phrase that could be two of her plans',
  choosePlan('thigh and splits work', PLANS) === null
);
check('empty text', choosePlan('', PLANS) === null);
check('somebody with no saved plans at all', choosePlan('my workout', []) === null);
// AMBIGUOUS WORDS SHE USES FOR ORDINARY MOVEMENT. "Barbell" alone singles out one
// plan, which is the behaviour - but a bare body part must not.
check(
  'a bare body part does not pick a plan',
  choosePlan('some thigh work', PLANS)?.id === '2' || choosePlan('some thigh work', PLANS) === null,
  `(returns ${choosePlan('some thigh work', PLANS)?.title ?? 'null'})`
);

console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
