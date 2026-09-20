// Is this save an edit of the plan being discussed, or a different plan?
//
//   npx tsx scripts/probe-plan-edit.mjs

import { editsAnchoredPlan } from '../app/lib/almanac.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${got}, wanted ${want})`}`);
};

const plan = (title, names) => ({
  id: 'x',
  kind: 'movement plan',
  title,
  content: { exercises: names.map((name) => ({ name })) },
});

const LEGS = plan('Inner Thigh Toning Routine', ['Sumo Squat', 'Curtsy Lunge', 'Side-Lying Leg Lift', 'Cossack Squat']);

console.log('\n  THE SAME PLAN\n');
check('same title, changed movements', editsAnchoredPlan(LEGS, plan('Inner Thigh Toning Routine', ['Sumo Squat', 'Curtsy Lunge', 'Copenhagen Plank'])), true);
check('title spelled differently', editsAnchoredPlan(LEGS, plan('inner thigh toning routine', ['Sumo Squat'])), true);
check('renamed, same movements', editsAnchoredPlan(LEGS, plan('Inner Thigh Strength', ['Sumo Squat', 'Curtsy Lunge', 'Cossack Squat'])), true);

console.log('\n  A DIFFERENT PLAN\n');
check('a new plan asked for mid-conversation', editsAnchoredPlan(LEGS, plan('Shoulder Mobility', ['Wall Slide', 'Band Pull-Apart', 'Y Raise'])), false);
check('one movement in common is not a rename', editsAnchoredPlan(LEGS, plan('Leg Day', ['Sumo Squat', 'Leg Press', 'Hamstring Curl', 'Calf Raise'])), false);
check('no movements either side', editsAnchoredPlan({ ...LEGS, content: {} }, { kind: 'movement plan', title: 'Something Else', content: {} }), false);

console.log('\n  NOT A PLAN AT ALL\n');
check('a note saved while looking at a plan', editsAnchoredPlan(LEGS, { kind: 'note', title: 'Inner Thigh Toning Routine', content: {} }), false);
check('the anchor is not a plan', editsAnchoredPlan({ ...LEGS, kind: 'note' }, plan('Inner Thigh Toning Routine', ['Sumo Squat'])), false);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
