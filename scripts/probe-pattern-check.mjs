// "RUN A REPORT ON ALL DAYS I DRANK COCKTAILS AND MY MOOD THE FOLLOWING DAYS."
//
// Her question, 21 September 2026, and the sentence just before it that sets
// the standard: "catching things like low mood always 2 days after cocktails
// eg, could genuinely be unknown to a user and needs something to check if Ai
// says it."
//
// So these cases mostly test RESTRAINT. Three matching days must not become a
// finding, a column of blanks must not become an average, and the days that do
// not fit the story must still be in the table.
//
//   npx tsx scripts/probe-pattern-check.mjs

import {
  alongside,
  average,
  compare,
  coverage,
  ENOUGH_OCCASIONS,
  readOffsets,
  shiftDay,
  verdict,
} from '../app/lib/pattern-check.ts';

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

function truthy(name, v) {
  check(name, Boolean(v), true);
}

const M = (day, value) => ({ day, measure: 'mood', value });

group('moving a day');

check('one on', shiftDay('2026-09-21', 1), '2026-09-22');
check('two on', shiftDay('2026-09-21', 2), '2026-09-23');
check('across a month end', shiftDay('2026-09-30', 1), '2026-10-01');
check('backwards', shiftDay('2026-10-01', -1), '2026-09-30');
check('nonsense comes back unchanged', shiftDay('whenever', 1), 'whenever');

group('lining the days up');

check(
  'the day after each',
  alongside(['2026-09-01', '2026-09-08'], [M('2026-09-02', 2), M('2026-09-09', 4)], [1], 'mood'),
  [
    { day: '2026-09-01', after: [2] },
    { day: '2026-09-08', after: [4] },
  ]
);
// A MISSING RATING STAYS MISSING. Dropping it would turn "we have no idea about
// this one" into a tidier, falser table.
check(
  'a day with no rating is a blank, not a gap',
  alongside(['2026-09-01'], [], [1, 2], 'mood'),
  [{ day: '2026-09-01', after: [null, null] }]
);
check(
  'the offsets asked for, in order',
  alongside(['2026-09-01'], [M('2026-09-01', 5), M('2026-09-03', 1)], [0, 2], 'mood'),
  [{ day: '2026-09-01', after: [5, 1] }]
);
check(
  'another measure is not this measure',
  alongside(['2026-09-01'], [{ day: '2026-09-02', measure: 'energy', value: 1 }], [1], 'mood'),
  [{ day: '2026-09-01', after: [null] }]
);
check('the same day said twice is one day', alongside(['2026-09-01', '2026-09-01'], [], [1], 'mood').length, 1);
// AN OFF-SCALE VALUE IS NOT A RATING, wherever it came from.
check(
  'a rating off the scale is ignored',
  alongside(['2026-09-01'], [M('2026-09-02', 9)], [1], 'mood'),
  [{ day: '2026-09-01', after: [null] }]
);

group('how much of it is actually rated');

check('all of it', coverage([{ after: [2, 3] }]), { have: 2, of: 2 });
check('half of it', coverage([{ after: [2, null] }, { after: [null, 4] }]), { have: 2, of: 4 });
check('none of it', coverage([{ after: [null] }]), { have: 0, of: 1 });

group('averages');

check('a plain mean, to one decimal', average([2, 3, 4]), 3);
check('rounded', average([2, 3]), 2.5);
check('blanks are not zeroes', average([4, null, 4]), 4);
check('nothing to average', average([null, null]), null);

group('the comparison, which is against every OTHER rated day');

// Her example shape: mood the day after a night out, against ordinary days.
const nights = ['2026-09-04', '2026-09-11', '2026-09-18'];
const ratings = [
  M('2026-09-05', 2),
  M('2026-09-12', 2),
  M('2026-09-19', 1),
  M('2026-09-07', 4),
  M('2026-09-08', 4),
  M('2026-09-14', 5),
];
const lined = alongside(nights, ratings, [1], 'mood');
const cmp = compare(lined, ratings, [1], 'mood');
check('the days after', cmp.onThose, 1.7);
check('every other rated day', cmp.otherwise, 4.3);
check('and what each rests on', [cmp.fromThose, cmp.fromOthers], [3, 3]);

// THE NIGHTS THEMSELVES ARE NOT ORDINARY DAYS. Asked about the day AFTER, a
// cocktail evening is neither "those days" nor a fair picture of a normal week,
// so it sits out of both columns rather than propping up the comparison.
const withNightRatings = [...ratings, M('2026-09-04', 5), M('2026-09-11', 5)];
const cmp2 = compare(alongside(nights, withNightRatings, [1], 'mood'), withNightRatings, [1], 'mood');
check('the nights themselves are excluded from both', cmp2.otherwise, 4.3);

// ONE DAY COUNTS ONCE. Two nights back to back, asked about the one and two
// days after each, both point at the same middle day - and counting it twice
// would weight it for no reason but the shape of the week.
const backToBack = ['2026-09-04', '2026-09-05'];
const shared = [M('2026-09-05', 1), M('2026-09-06', 1), M('2026-09-07', 5)];
const cmp3 = compare(alongside(backToBack, shared, [1, 2], 'mood'), shared, [1, 2], 'mood');
check('an overlapping day is counted once', cmp3.fromThose, 3);

// THE INDEX IS NOT THE OFFSET. Asked about the day itself and two days later,
// reading the slot number as a day count would put the second reading on the
// wrong date.
const gapped = alongside(['2026-09-01'], [M('2026-09-01', 5), M('2026-09-03', 1)], [0, 2], 'mood');
check('offsets that skip a day land on the right dates', compare(gapped, [M('2026-09-01', 5), M('2026-09-03', 1)], [0, 2], 'mood').fromThose, 2);

group('what it will and will not say');

check('nothing found', verdict([], { have: 0, of: 0 }).standing, 'There are no days on record matching that yet.');
check('nothing found is not worth reading', verdict([], { have: 0, of: 0 }).worthReading, false);

// A COLUMN OF BLANKS IS NOT EVIDENCE.
const noRatings = verdict([{ day: 'a', after: [null] }, { day: 'b', after: [null] }], { have: 0, of: 2 });
truthy('days but no ratings says exactly that', noRatings.standing.includes('nothing to compare'));
check('and is not worth reading', noRatings.worthReading, false);

// THREE MATCHING DAYS IS A COINCIDENCE, NOT A FINDING. This is the case the
// whole file exists for: an app that calls this a pattern has invented a cause
// out of noise and attached it to somebody's body.
const few = verdict([{ day: 'a', after: [2] }, { day: 'b', after: [2] }, { day: 'c', after: [1] }], { have: 3, of: 3 });
truthy('a handful of days is called too few', few.standing.includes('too few'));
truthy('and says why', few.standing.includes('chance'));
check('and is not worth reading', few.worthReading, false);

const plenty = Array.from({ length: ENOUGH_OCCASIONS + 1 }, (_, i) => ({ day: `d${i}`, after: [2] }));
const enough = verdict(plenty, { have: 6, of: 6 });
check('enough days is worth reading', enough.worthReading, true);
// EVEN THEN IT DOES NOT CONCLUDE. It reports the size of the evidence and stops.
check('and still claims nothing', /pattern|link|because|causes/i.test(enough.standing), false);
truthy('it says how many were rated', enough.standing.includes('6 of 6'));

group('which days after');

check('nothing given means the day after', readOffsets(undefined), [1]);
check('one number', readOffsets(2), [2]);
check('a list, sorted and deduped', readOffsets([2, 0, 2]), [0, 2]);
check('strings the model sent', readOffsets(['1', '2']), [1, 2]);
// BEFORE THE DAY IS A DIFFERENT QUESTION. What happened before something is not
// what followed it.
check('a day before is dropped', readOffsets([-1, 1]), [1]);
check('beyond a week is dropped', readOffsets([1, 30]), [1]);
check('all nonsense falls back to the day after', readOffsets(['soon']), [1]);

group('her actual question: cocktails, and the days after');

const herNights = ['2026-09-04', '2026-09-11', '2026-09-18'];
const herRatings = [
  // After the first night: flat, then low.
  M('2026-09-05', 2),
  M('2026-09-06', 1),
  // After the second: nothing logged on the first day, low on the second.
  M('2026-09-13', 1),
  // After the third: good, then good. The night that does not fit the story.
  M('2026-09-19', 4),
  M('2026-09-20', 4),
  // A different measure on the same day, which must not leak in.
  { day: '2026-09-05', measure: 'energy', value: 5 },
];

const table = alongside(herNights, herRatings, [1, 2], 'mood');

check('a row per night, oldest first', table.map((r) => r.day), herNights);
check('the first night, flat then low', table[0].after, [2, 1]);
// A DAY NOBODY RATED IS A BLANK, NOT A ZERO AND NOT A SKIP. Dropping it would
// quietly improve the pattern by removing the evidence against it.
check('a day with nothing logged is a blank', table[1].after, [null, 1]);
// THE NIGHT THAT DOES NOT FIT STAYS IN THE TABLE. This is the case the whole
// feature is judged by.
check('and the night that contradicts it is still there', table[2].after, [4, 4]);
check('another measure does not leak in', alongside(herNights, herRatings, [1], 'energy')[0].after, [5]);
check('five of six here', coverage(table), { have: 5, of: 6 });
check('nothing logged at all', coverage(alongside(herNights, [], [1, 2], 'mood')), { have: 0, of: 6 });
check('no nights, nothing to cover', coverage(alongside([], herRatings, [1], 'mood')), { have: 0, of: 0 });

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
