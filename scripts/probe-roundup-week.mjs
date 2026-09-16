// Which week is a roundup for, and when is one owed?
//
// The failures that matter: a roundup written for a week that has not finished,
// two roundups for one week, a week silently skipped, or invented witness
// statements. Pure functions, no API, free to run.
//
//   npx tsx scripts/probe-roundup-week.mjs

import {
  coerceStatements,
  isValidWeekEnding,
  isoDate,
  parseIsoDate,
  roundupContent,
  roundupTitle,
  weekDatesEnding,
  weekEndingFor,
  weekEndingMinus,
} from '../app/lib/roundup-week.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

// September 2026: the 13th and the 20th are Sundays.
const at = (iso, h = 12, m = 0) => {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m);
};

console.log('\n  SUNDAY IS ONLY OVER IN THE EVENING\n');
check('Sunday at 18:00: that Sunday closes the week', weekEndingFor(at('2026-09-20', 18)), '2026-09-20');
check('Sunday at 23:59: still that Sunday', weekEndingFor(at('2026-09-20', 23, 59)), '2026-09-20');
check('Sunday at 17:59: the week before', weekEndingFor(at('2026-09-20', 17, 59)), '2026-09-13');
check('Monday morning: yesterday closed it', weekEndingFor(at('2026-09-21', 8)), '2026-09-20');
check('Saturday: still the previous Sunday', weekEndingFor(at('2026-09-19', 21)), '2026-09-13');
check('Wednesday: the previous Sunday', weekEndingFor(at('2026-09-16', 8, 33)), '2026-09-13');

console.log('\n  THE WEEK IS MONDAY TO SUNDAY\n');
const week = weekDatesEnding('2026-09-20');
check('seven days', week.length, 7);
check('starts on the Monday', week[0], '2026-09-14');
check('ends on the Sunday', week[6], '2026-09-20');
check('a bad date has no week', weekDatesEnding('not-a-date'), []);
check('six weeks back', weekEndingMinus('2026-09-20', 6), '2026-08-09');

console.log('\n  A WEEK THE APP MAY ROUND UP\n');
const wed = at('2026-09-16', 8, 33);
check('the last complete week', isValidWeekEnding('2026-09-13', wed), true);
check('an older week is still valid', isValidWeekEnding('2026-08-30', wed), true);
check('a week that has not finished', isValidWeekEnding('2026-09-20', wed), false);
check('a Monday is not a week ending', isValidWeekEnding('2026-09-14', wed), false);
check('nonsense', isValidWeekEnding('2026-13-45', wed), false);
check('not a string', isValidWeekEnding(20260913, wed), false);
check('an impossible date is rejected', parseIsoDate('2026-02-30'), null);

console.log('\n  STATEMENTS ARE TAKEN, NEVER PADDED\n');
check('three at most', coerceStatements(['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
check('blanks dropped', coerceStatements(['  ', 'moved four times a week', '']), ['moved four times a week']);
check('non-strings dropped', coerceStatements([1, null, { a: 1 }, 'kept']), ['kept']);
check('not an array', coerceStatements('two statements'), []);
check('nothing is invented from nothing', coerceStatements([]), []);
check('a very long one is cut, not dropped', coerceStatements(['x'.repeat(400)])[0].length, 200);

console.log('\n  WHAT A ROUNDUP STORES\n');
const content = roundupContent({
  reply: '  Your week, in your own words.  ',
  weekEnding: '2026-09-13',
  theme: ' rest ',
  statements: ['moved four times a week for six weeks'],
});
check('the roundup text is the visible content', content.summary, 'Your week, in your own words.');
check('the week is stored as plumbing', content.__weekEnding, '2026-09-13');
check('the theme is trimmed', content.__theme, 'rest');
check('no theme is null, not empty', roundupContent({ reply: 'x', weekEnding: '2026-09-13', statements: [] }).__theme, null);
check('every plumbing key is hidden by the reader', Object.keys(content).filter((k) => k !== 'summary').every((k) => k.startsWith('__')), true);
// A prefix, not an exact string: en-GB month abbreviations differ by ICU build
// ("13 Sep" on one, "13 Sept" on another), and the app's own entry dates use the
// same call, so the test asserts the shape the card shows rather than pinning a
// spelling that is not ours to choose.
check('the title names the week', roundupTitle('2026-09-13').startsWith('Week to 13 Sep'), true);
check('a bad week still gets a title', roundupTitle('nope'), 'Weekly roundup');
check('isoDate is local, not UTC', isoDate(new Date(2026, 8, 20, 23, 30)), '2026-09-20');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
