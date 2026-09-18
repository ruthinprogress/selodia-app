// Which saved routine did she mean, and when should the app decline to guess?
//
// Built for Ruth's ask of 2026-09-18: "there needs to be a way to just use live
// voice like 'I did the gym workout today but added some box jumps like 3 x 10'".
// Pure functions, no API, free to run.
//
//   npx tsx scripts/probe-workout-session.mjs

import { choosePlan, nameWords } from '../app/lib/workout-session.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`
  );
};

const barbell = { id: 'barbell', title: 'Full-Body Barbell Strength Plan' };
const thighs = { id: 'thighs', title: 'Inner Thigh Toning Routine' };
const wind = { id: 'wind', title: 'Evening Wind-Down' };
const LIBRARY = [barbell, thighs, wind];

const pick = (said, plans = LIBRARY) => choosePlan(said, plans)?.id ?? null;

console.log('\n  NAMING IT\n');
check('word for word', pick('Full-Body Barbell Strength Plan'), 'barbell');
check('the distinctive word', pick('the barbell routine'), 'barbell');
check('a different plan entirely', pick('inner thigh toning'), 'thighs');
check('case and punctuation', pick('EVENING WIND-DOWN!'), 'wind');

console.log('\n  WHEN IT MUST DECLINE TO GUESS\n');
// "Workout", "routine", "plan", "today" and "full body" are in every other
// title; matching on them would pick a routine at random.
check('"the gym workout today", three plans saved', pick('the gym workout today'), null);
check('a plan she has not saved', pick('my pilates class'), null);
check('nothing said at all', pick(''), null);
// Two plans sharing the only distinctive word is a tie, and a tie is a question
// for her rather than a coin toss.
check(
  'a word two plans share',
  pick('the strength one', [
    { id: 'a', title: 'Barbell Strength Plan' },
    { id: 'b', title: 'Kettlebell Strength Plan' },
  ]),
  null
);

console.log('\n  THE ONE-PLAN CASE\n');
// Somebody with a single saved routine who says "I did my workout today" means
// that one, and asking which would be obtuse.
check('one plan, a vague sentence', pick('my workout today', [barbell]), 'barbell');
check('one plan, but she named another', pick('my pilates class', [barbell]), null);
check('no plans saved at all', pick('the gym workout', []), null);

console.log('\n  WHAT COUNTS AS A DISTINCTIVE WORD\n');
check('grammar and generics are dropped', [...nameWords('the full body workout plan today')], []);
check('the real words survive', [...nameWords('Inner Thigh Toning Routine')], ['inner', 'thigh', 'toning']);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
