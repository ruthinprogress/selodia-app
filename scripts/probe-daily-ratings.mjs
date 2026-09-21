// HOW A DAY FELT, AND WHAT MAY BE SAID ABOUT IT.
//
// Ruth, 21 September 2026: "catching things like low mood always 2 days after
// cocktails eg, could genuinely be unknown to a user and needs something to
// check if Ai says it." And then: "could the user say, run a report on all days
// i drank cocktails and my mood the following days?"
//
// So these checks are about lining days up honestly - including the days that
// do not fit the story, and including how much of the table is actually blank.
//
//   npx tsx scripts/probe-daily-ratings.mjs

import {
  MEASURES,
  measure,
  ratingsByMeasure,
  wordFor,
} from '../mobile/src/lib/daily-ratings.ts';

let passed = 0;
let failed = 0;

function group(name) {
  console.log(`\n  ${name.toUpperCase()}\n`);
}

function check(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        got  ${a}`);
    console.log(`        want ${b}`);
  }
}

function truthy(name, value) {
  check(name, Boolean(value), true);
}

group('the words, and the numbers underneath them');

truthy('mood and energy both ship', MEASURES.length >= 2);
truthy('every measure has exactly five words', MEASURES.every((m) => m.words.length === 5));
// LOW TO HIGH, ALWAYS. Two measures share a column in a table, so one of them
// running the other way would make a chart silently wrong.
check('1 is the low end of mood', wordFor('mood', 1), 'Low');
check('5 is the high end of mood', wordFor('mood', 5), 'Bright');
check('1 is the low end of energy too', wordFor('energy', 1), 'Drained');
check('5 is the high end of energy too', wordFor('energy', 5), 'Buzzing');

check('a value nobody stored is no word', wordFor('mood', null), null);
check('a value out of range is no word', wordFor('mood', 9), null);
check('a measure that does not exist is no word', wordFor('sparkle', 3), null);
check('and is not a measure', measure('sparkle'), null);

group('reading a day back');

check(
  'two measures on one day',
  ratingsByMeasure([
    { measure: 'mood', value: 2, note: 'slept badly' },
    { measure: 'energy', value: 1, note: null },
  ]),
  {
    mood: { measure: 'mood', value: 2, note: 'slept badly' },
    energy: { measure: 'energy', value: 1, note: null },
  }
);
check('a measure the app no longer has is ignored', ratingsByMeasure([{ measure: 'vibes', value: 3, note: null }]), {});
check('so is a value out of range', ratingsByMeasure([{ measure: 'mood', value: 0, note: null }]), {});
check('and so is one that is not a number', ratingsByMeasure([{ measure: 'mood', value: NaN, note: null }]), {});

// THE CORRELATION CASES MOVED WITH THE CODE (21 September 2026). "cocktails,
// and the days after" is answered on the server now, so its probes live in
// probe-pattern-check.mjs beside the arithmetic they test.

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
