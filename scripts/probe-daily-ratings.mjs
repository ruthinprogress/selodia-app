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
  alongside,
  coverage,
  MEASURES,
  measure,
  ratingsByMeasure,
  shiftDay,
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

group('shifting a day');

check('one day on', shiftDay('2026-09-21', 1), '2026-09-22');
check('two days on', shiftDay('2026-09-21', 2), '2026-09-23');
check('across a month end', shiftDay('2026-09-30', 1), '2026-10-01');
check('backwards', shiftDay('2026-10-01', -1), '2026-09-30');
check('nonsense comes back unchanged', shiftDay('whenever', 1), 'whenever');

group('her actual question: cocktails, and the days after');

const nights = ['2026-09-04', '2026-09-11', '2026-09-18'];
const ratings = [
  // After the first night: flat, then low.
  { day: '2026-09-05', measure: 'mood', value: 2 },
  { day: '2026-09-06', measure: 'mood', value: 1 },
  // After the second: nothing logged on the first day, low on the second.
  { day: '2026-09-13', measure: 'mood', value: 1 },
  // After the third: good, then good. The night that does not fit the story.
  { day: '2026-09-19', measure: 'mood', value: 4 },
  { day: '2026-09-20', measure: 'mood', value: 4 },
  // A different measure on the same day, which must not leak in.
  { day: '2026-09-05', measure: 'energy', value: 5 },
];

const table = alongside(nights, ratings, [1, 2], 'mood');

check('a row per night, oldest first', table.map((r) => r.day), nights);
check('the first night, flat then low', table[0].after, [2, 1]);
// A DAY NOBODY RATED IS A BLANK, NOT A ZERO AND NOT A SKIP. Dropping it would
// quietly improve the pattern by removing the evidence against it.
check('a day with nothing logged is a blank', table[1].after, [null, 1]);
// THE NIGHT THAT DOES NOT FIT STAYS IN THE TABLE.
check('and the night that contradicts it is still there', table[2].after, [4, 4]);
check('another measure does not leak in', alongside(nights, ratings, [1], 'energy')[0].after, [5]);

group('how much of it is actually blank');

// "Mood on the two days after" across three nights where four of the six days
// were never rated is a table of blanks pretending to be evidence, and a caller
// needs to know that before it draws anything.
check('five of six here', coverage(table), { have: 5, of: 6 });
check('nothing logged at all', coverage(alongside(nights, [], [1, 2], 'mood')), { have: 0, of: 6 });
check('no nights, nothing to cover', coverage(alongside([], ratings, [1], 'mood')), { have: 0, of: 0 });

group('the same night logged twice is one night');

check(
  'duplicates collapse',
  alongside(['2026-09-04', '2026-09-04'], ratings, [1], 'mood').length,
  1
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
