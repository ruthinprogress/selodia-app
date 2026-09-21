// WHAT HER OWN CYCLES SAY, AND WHAT THEY DO NOT.
//
// Ruth's correction is the whole reason this file exists: "we are designing for
// Selodia as a multiuser app with thousands of users and this is a test account
// - it needs to be properly scoped, not build for the test account's current
// test state."
//
// So these checks are about a person with history, and about the two ways a
// cycle feature lies: predicting from too little, and predicting a date when
// the honest answer is a window.
//
//   npx tsx scripts/probe-cycle-history.mjs

import {
  completedCycles,
  cycleDayOn,
  describeToday,
  expectedNextPeriod,
  knowledgeFrom,
  NOMINAL_LENGTH,
  periodStarts,
  phaseForCycleDay,
} from '../mobile/src/lib/cycle-history.ts';
import {
  isEmptyDay,
  emptyDay,
  readTemperature,
  symptomChoices,
  toggleChoice,
} from '../mobile/src/lib/cycle-day.ts';

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

const starts = (...days) => days.map((d) => ({ event_date: d, event_type: 'period_start' }));

group('reading the events');

check('period starts come back oldest first', periodStarts(starts('2026-03-02', '2026-01-04', '2026-02-01')), [
  '2026-01-04',
  '2026-02-01',
  '2026-03-02',
]);
check('a day logged twice is one start', periodStarts(starts('2026-01-04', '2026-01-04')), ['2026-01-04']);
check('other kinds of event are ignored', periodStarts([{ event_date: '2026-01-04', event_type: 'spotting' }]), []);
check('a timestamp is read as its day', periodStarts([{ event_date: '2026-01-04T22:10:00Z', event_type: 'period_start' }]), [
  '2026-01-04',
]);
check('nonsense is not a date', periodStarts([{ event_date: 'soon', event_type: 'period_start' }]), []);

group('a gap in the record is not a cycle');

// SHE FORGOT TO LOG FOR TWO MONTHS. Letting that into an average would wreck
// every prediction after it, so it is excluded - and nothing is deleted or
// corrected, because the event is exactly what she entered.
check(
  'a 90-day interval is a missed log',
  completedCycles(starts('2026-01-01', '2026-04-01')).length,
  0
);
check(
  'and so is a 5-day one',
  completedCycles(starts('2026-01-01', '2026-01-06')).length,
  0
);
check(
  'a long but real cycle is kept',
  completedCycles(starts('2026-01-01', '2026-02-07')).map((c) => c.length),
  [37]
);

group('how much the app is entitled to claim');

check('nothing logged, nothing known', knowledgeFrom([]).basis, 'none');

const one = knowledgeFrom(starts('2026-08-24'));
check('one period start is a position, not a length', one.basis, 'nominal');
check('and it names no average', one.averageLength, null);
check('but it knows where she is counting from', one.lastStart, '2026-08-24');

const two = knowledgeFrom(starts('2026-07-01', '2026-07-29'));
check('two cycles is still an anecdote', two.basis, 'nominal');

const four = knowledgeFrom(starts('2026-05-04', '2026-06-01', '2026-06-30', '2026-07-27', '2026-08-24'));
check('four completed cycles is her own average', four.basis, 'hers');
check('the average is hers, not the textbook', four.averageLength, 28);
check('and it says how many it rests on', four.cycles, 4);

const varied = knowledgeFrom(starts('2026-04-01', '2026-04-25', '2026-05-26', '2026-06-19', '2026-07-21'));
truthy('an irregular history still averages', varied.basis === 'hers');
truthy('but carries a wider spread', varied.spread >= 3);

group('a prediction, or honestly none');

// WITH ONE DATE THERE IS NO PREDICTION. A single start says where she is; it
// says nothing about how long her cycles run, and a date from a textbook
// average would look exactly as confident as one from her own history.
check('one period start predicts nothing', expectedNextPeriod(one), null);
check('two do not either', expectedNextPeriod(two), null);

const next = expectedNextPeriod(four);
truthy('four cycles do predict', next !== null);
check('and the date is her average from her last start', next.on, '2026-09-21');
// A TIGHT HISTORY STILL CARRIES ITS SPREAD. Cycles of 27, 28 and 29 days are
// regular, and "give or take a day" is the truthful way to say so - a hard date
// would be claiming a precision four cycles cannot support.
check('a regular history gives a narrow window', next.give, 1);

const loose = expectedNextPeriod(varied);
truthy('an irregular history gives a wider one', loose.give > next.give);
// Identical cycles are the only case that earns a date.
const exact = expectedNextPeriod(knowledgeFrom(starts('2026-06-01', '2026-06-29', '2026-07-27', '2026-08-24')));
check('four identical cycles give a date', exact.give, 0);

group('phase counts back from the next period, not forward from the last');

check('day 3 is menstrual', phaseForCycleDay(3), 'menstrual');
check('day 9 of 28 is follicular', phaseForCycleDay(9, 28), 'follicular');
check('day 14 of 28 is ovulatory', phaseForCycleDay(14, 28), 'ovulatory');
check('day 22 of 28 is luteal', phaseForCycleDay(22, 28), 'luteal');

// THE ONE A FIXED TABLE GETS WRONG. On a 35-day cycle it is the FOLLICULAR
// phase that stretches; the luteal phase stays about 14 days. A chart that puts
// ovulation on day 14 regardless would call day 21 luteal when she is ovulating.
check('day 21 of a 35-day cycle is ovulatory', phaseForCycleDay(21, 35), 'ovulatory');
check('day 14 of a 35-day cycle is still follicular', phaseForCycleDay(14, 35), 'follicular');
check('day 30 of a 35-day cycle is luteal', phaseForCycleDay(30, 35), 'luteal');

group('counting the day');

check('the day it started is day 1', cycleDayOn('2026-09-01', '2026-09-01'), 1);
check('a week later is day 8', cycleDayOn('2026-09-01', '2026-09-08'), 8);
check('before the start is not a cycle day', cycleDayOn('2026-09-10', '2026-09-01'), null);

group('what it says out loud');

truthy(
  'with one period it says the estimate is nominal, and why',
  describeToday(one, '2026-09-01').includes(`${NOMINAL_LENGTH}-day cycle`)
);
truthy(
  'with history it says the average is hers',
  describeToday(four, '2026-09-01').includes('your own average')
);
truthy('and how many cycles that rests on', describeToday(four, '2026-09-01').includes('4 cycles'));
check('with nothing logged it says nothing at all', describeToday(knowledgeFrom([]), '2026-09-01'), null);

group('her own words, kept');

// "Add Another ... we should keep that as a user generated option that's
// tracked if they create it." So a symptom she invents is offered back to her
// from then on, and offered FIRST - what she has recorded before is likelier
// than what the app guessed at.
const mine = symptomChoices(['Jaw tension', 'Cramps']);
check('her own come first', mine.slice(0, 2), ['Jaw tension', 'Cramps']);
truthy('and the common ones follow', mine.includes('Bloating'));
check('a symptom she shares with the list appears once', mine.filter((s) => s.toLowerCase() === 'cramps').length, 1);
check('her spelling wins over the app', symptomChoices(['cramps'])[0], 'cramps');
check('blank entries are not choices', symptomChoices(['  ', 'Cramps']).includes(''), false);

check('toggling adds', toggleChoice([], 'Cramps'), ['Cramps']);
check('toggling again removes', toggleChoice(['Cramps'], 'Cramps'), []);
check('and matching ignores case', toggleChoice(['cramps'], 'Cramps'), []);

group('a temperature, or nothing');

// A WRONG BASAL TEMPERATURE IS WORSE THAN NONE. The signal is a shift of two or
// three tenths of a degree, so a mistyped 37 where 36.7 was meant erases the
// very thing it was recorded for.
check('an ordinary reading', readTemperature('36.62'), 36.62);
check('a comma for a point', readTemperature('36,62'), 36.62);
check('Fahrenheit is converted, not refused', readTemperature('97.8'), 36.56);
check('a temperature no living person has is refused', readTemperature('12'), null);
check('and so is a typo', readTemperature('366'), null);
check('and so is a word', readTemperature('warm'), null);

group('an empty form writes nothing');

truthy('a blank day is empty', isEmptyDay(emptyDay('2026-09-21')));
truthy('a note alone is not', !isEmptyDay({ ...emptyDay('2026-09-21'), notes: 'slept badly' }));
truthy('whitespace is still empty', isEmptyDay({ ...emptyDay('2026-09-21'), notes: '   ' }));
truthy('a temperature alone is not', !isEmptyDay({ ...emptyDay('2026-09-21'), temperatureC: 36.6 }));

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
