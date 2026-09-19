// Does a reply to a weigh-in stay inside what it was shown?
//
// Bug 11 on Ruth's list, 18 September: "A comment on a weight change invented
// reasons - 'yesterday was salty', 'you had a hard session a day or two ago' -
// with nothing logged to support either." The first case below is the message
// she actually received, word for word. Pure function, no API.
//
//   npx tsx scripts/probe-ack-invented-context.mjs

import { readInventsContext } from '../app/lib/log-acknowledgment.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
};

const facts = `Friday 18 September · weigh-in logged

Weight 56.5 kg  ↘ -0.1 vs 2 days ago
Body fat 27.7%
Muscle 38.5 kg`;

const bad = (read) => readInventsContext('body_measurement', read, facts);

console.log('\n  THE MESSAGE SHE ACTUALLY GOT\n');
check(
  'invented causes AND a number that contradicts the block',
  bad("Weight's up 0.3 kg since yesterday, but yesterday was on the salty side and you had a hard session a day or two ago."),
  true
);

console.log('\n  ATTRIBUTIONS TO HER DAY, HOWEVER HEDGED\n');
// Ruth, 2026-09-19: "a weight increase should never be attributed to salty
// food, exercise, hormones or anything else unless the user has actually logged
// information supporting that interpretation."
check('salt', bad('Probably a bit of salt from yesterday.'), true);
check('salt, hedged, is still an attribution', bad('Might be the salty food.'), true);
check('training', bad('Your training this week may be showing.'), true);
check('the cycle', bad('Worth remembering where you are in your cycle.'), true);
check('sleep', bad('A short night of sleep can do this.'), true);
check('carbs', bad('Carbs hold water, so this may settle.'), true);

console.log('\n  GENERAL POSSIBILITIES, CLEARLY LABELLED, ARE ALLOWED\n');
// Also Ruth: Selodia may "explain scientifically plausible possibilities
// (clearly labelled as possibilities)". The first version of this guard
// dropped these too, which was stricter than the principle.
check('a labelled general mechanism', bad('Weight often moves with water from day to day.'), false);
check('hedged, and about nothing she did', bad('Could just be water.'), false);
check('water as a claim about HER body', bad("You're probably retaining water."), true);
check('water stated as the cause, unlabelled', bad('That is water retention.'), true);
check(
  'a possibility in one sentence, a claim about her in the next',
  bad('Weight can move with water. Your fluid was up yesterday.'),
  true
);

console.log('\n  NUMBERS THAT ARE NOT ON SCREEN\n');
check('a different change', bad('That is up 0.3 kg on last week.'), true);
check('a made-up earlier weight', bad('You were 57.2 kg a fortnight ago.'), true);
check('a number that IS on screen is fine', bad('Muscle holding at 38.5 kg is the steady part.'), false);
check('the same change, written without its sign', bad('Down 0.1 kg is well within a normal day.'), false);

console.log('\n  WHAT A GOOD READ LOOKS LIKE\n');
check('a plain observation', bad('Barely moved. A steady read.'), false);
check('forward-looking', bad('One to watch alongside the next few mornings.'), false);
check('silence', bad(null), false);

console.log('\n  IT ONLY POLICES WEIGH-INS\n');
// A food reply is shown the food, so "salty" can be a fact about the meal.
check(
  'a food read may talk about salt',
  readInventsContext('food', 'That one is on the salty side.', 'Lunch · 1,200mg sodium'),
  false
);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
