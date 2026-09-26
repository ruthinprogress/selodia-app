// Does the guard catch a stated body measurement the classifier threw away,
// without catching dinner?
//
// The live case first: Ruth typed a thigh measurement of 54cm on 26 September
// 2026 and the app said it had it. Nothing was written, because `logIntent`
// came back 'none' - which is what its instruction asks for, since that
// instruction defines a measurement as a weight, a body fat or a muscle mass.

import { namesATrackedMetric } from '../app/lib/stated-measurement.ts';

const CASES = [
  // [text, known metrics, expected, why]
  ['thigh 54cm', [], true, "THE LIVE ONE. 26 September 2026, and it logged nothing."],
  ['thighs 54', [], true, 'Plural, no unit.'],
  ['my thigh is 54 cm this morning', [], true, 'A whole sentence around it.'],
  ['waist 79cm', [], true, 'The other half of the August bug.'],
  ['Waist 70cm / Thighs 52.5cm', [], true, 'Her exact words on 27 August 2026.'],
  ['blood pressure 120 over 80', [], true, 'A paired reading.'],
  ['resting heart rate 58', [], true, 'Not a tape measurement at all.'],
  ['bra band 34', ['bra band'], true, 'Tracked by her, not on any list.'],
  ['left thigh 54', ['left thigh'], true, 'Her own name for it wins.'],

  // Things that must NOT be pulled into the measurement writer.
  ['my waist feels smaller', [], false, 'No number, so nothing to store.'],
  ['thigh', [], false, 'A word on its own.'],
  ['I had a hippo shaped biscuit, 2 of them', [], false, 'hippo is not hip.'],
  ['the kitchen was warm, about 3 hours', [], false, 'warm is not arm.'],
  ['charmed to be asked, 4 times', [], false, 'charmed is not arm either.'],
  ['I walked 5km', [], false, 'Activity, and no body part named.'],
  ['2 eggs and toast', [], false, 'Breakfast.'],

  // Known and accepted: this DOES match, and is held back one layer up.
  // statesATrackedMetric is only consulted when the classifier said 'none', so
  // a message read as food keeps its own route. Recorded here so the next
  // person to read this knows it is deliberate and where the real guard is.
  ['chicken thighs, 200g', [], true, 'ACCEPTED: held back by the intent check, not here.'],
];

let failed = 0;
console.log('\n  A STATED MEASUREMENT THE CLASSIFIER DROPPED\n');
for (const [text, known, expected, why] of CASES) {
  const got = namesATrackedMetric(text, known);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${String(got).padEnd(5)} ${JSON.stringify(text).padEnd(38)} ${why}`
  );
}
console.log(`\n  ${CASES.length - failed}/${CASES.length} passed\n`);
process.exit(failed ? 1 : 0);
