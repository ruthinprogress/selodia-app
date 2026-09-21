// THE LABELS AROUND HER OWN DAYS.
//
// The arithmetic is probed in probe-pattern-check.mjs. This is the half that
// can lie without any number being wrong: a column headed "Next day" that is
// actually showing two days later, or an average printed as a decimal so it
// reads as a measurement of somebody's fortnight.
//
//   npx tsx scripts/probe-pattern-table.mjs

import {
  averageLabel,
  cell,
  comparisonLine,
  dayLabel,
  offsetLabel,
  patternHeading,
  windowLine,
} from '../mobile/src/lib/pattern-table.ts';
import { wordFor } from '../mobile/src/lib/daily-ratings.ts';

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

group('the column headings');

check('the day itself', offsetLabel(0), 'Same day');
check('the day after', offsetLabel(1), 'Next day');
check('two days after', offsetLabel(2), '2 days after');
check('a week after', offsetLabel(7), '7 days after');

group('what the table says it is');

check('her exact question', patternHeading('cocktail', 'mood', [1]), 'Cocktail, and mood the next day');
check('the same day', patternHeading('wine', 'energy', [0]), 'Wine, and energy the same day');
check('two days later', patternHeading('wine', 'mood', [2]), 'Wine, and mood 2 days after');
check('more than one', patternHeading('run', 'energy', [1, 2]), 'Run, and energy the days after');
check('their own capitalisation is not preserved oddly', patternHeading('  gin  ', 'mood', [1]), 'Gin, and mood the next day');

group('the days');

// "Sept" rather than "Sep" is what en-GB gives for September, and it is the
// British spelling - the point of the case is the SHAPE: weekday, day, month,
// and no year, because the year is never in doubt inside a 120 day window.
check('short, with no year', dayLabel('2026-09-15'), 'Tue 15 Sept');
check('a month whose name does not shorten oddly', dayLabel('2026-10-01'), 'Thu 1 Oct');
check('nonsense comes back unchanged', dayLabel('whenever'), 'whenever');

group('the cells');

check('a rating is a word', cell('mood', 2, wordFor), 'Flat');
check('the top of energy', cell('energy', 5, wordFor), 'Buzzing');
// AN UNRATED DAY IS SHOWN AS UNRATED, never as a middle value. A blank filled
// in as "Steady" is the app inventing how somebody felt.
check('a day nobody rated', cell('mood', null, wordFor), '\u2014');
check('a value off the scale', cell('mood', 9, wordFor), '\u2014');

group('the averages');

// A MEAN OF FIVE ORDERED WORDS IS NOT A MEASUREMENT, so the word leads and the
// figure follows in brackets.
check('the word leads', averageLabel('mood', 2.1, wordFor), 'Flat (2.1)');
check('rounded to the nearest word', averageLabel('mood', 2.6, wordFor), 'Steady (2.6)');
check('nothing to average', averageLabel('mood', null, wordFor), null);

group('the line under the table');

const payload = {
  trigger: 'cocktail',
  measure: 'mood',
  offsets: [1],
  windowDays: 120,
  matches: [],
  rows: [],
  cover: { have: 3, of: 3 },
  comparison: { onThose: 1.7, otherwise: 4.3, fromThose: 3, fromOthers: 12 },
  verdict: { standing: '', worthReading: false },
};
check(
  'both sides, with what each rests on',
  comparisonLine(payload, wordFor),
  'Mood on those days: Flat (1.7), from 3 rated days. Every other rated day: Good (4.3), from 12.'
);
check(
  'one rated day reads as a day',
  comparisonLine({ ...payload, comparison: { ...payload.comparison, fromThose: 1 } }, wordFor).includes('1 rated day.'),
  true
);
// ONE AVERAGE WITH NOTHING TO COMPARE IT AGAINST is a number floating free, and
// the reader supplies the comparison out of whatever they already suspected.
check(
  'no comparison, no line',
  comparisonLine({ ...payload, comparison: { onThose: 2, otherwise: null, fromThose: 3, fromOthers: 0 } }, wordFor),
  null
);

// WHAT WAS SEARCHED IS ALWAYS SAID, so a search that found the wrong thing is
// visible rather than buried in an average.
check(
  'the window and the term',
  windowLine(payload),
  'Looked back over the last 120 days, for "cocktail" in what you logged.'
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
