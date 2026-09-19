// Does today's water goal come out as expected, with its reasons? Pure, free.
//
//   npx tsx scripts/probe-hydration-goal.mjs

import { dropletFill, formatVolume, GOAL_FILL, hydrationGoal } from '../mobile/src/lib/hydration-goal.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

console.log('\n  THE GOAL\n');
check('no activity: the baseline', hydrationGoal({ activityMinutesToday: 0 }).ml, 1600);
check('no activity: one reason only', hydrationGoal({ activityMinutesToday: 0 }).reasons.length, 1);
check('an hour adds about 500 ml', hydrationGoal({ activityMinutesToday: 60 }).ml, 2100);
check('45 minutes rounds sensibly', hydrationGoal({ activityMinutesToday: 45 }).ml, 2000);
check('the activity reason names the minutes', hydrationGoal({ activityMinutesToday: 45 }).reasons[1].startsWith("Today's 45 minutes"), true);
check('nonsense minutes are ignored', hydrationGoal({ activityMinutesToday: NaN }).ml, 1600);
check('negative minutes are ignored', hydrationGoal({ activityMinutesToday: -30 }).ml, 1600);

console.log('\n  THE DROPLET IS NOT A SCORE\n');
check('empty is empty', dropletFill(0, 1800), 0);
check('the goal sits below the brim', dropletFill(1800, 1800), GOAL_FILL);
check('past the goal keeps filling', dropletFill(2200, 1800) > GOAL_FILL, true);
check('never quite full', dropletFill(9000, 1800), 0.96);

console.log('\n  WORDS\n');
check('under a litre in ml', formatVolume(250), '250 ml');
check('a litre and over in L', formatVolume(1800), '1.8 L');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
