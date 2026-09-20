// A SUMMARY MAY NOT INVENT A NUMBER.
//
// The summary at the top of a report is the one page a clinician reads first,
// and Ruth's argument for the whole feature rests on it being trustworthy:
// "if the data is just the data collected, the report can't be dismissed as AI
// dumps, it's the true collected data, with a summary for convenience."
//
// So the arithmetic happens in code and the guard reads the result. These are
// the checks on both halves.
//
//   npx tsx scripts/probe-report-summary.mjs

import { facts, numbersIn, withoutFigures } from '../app/lib/report-summary.ts';

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

const empty = {
  name: null,
  dateOfBirth: null,
  generated: '2026-09-20',
  periodLabel: 'Last 3 months',
  note: null,
  profile: [],
  goals: [],
  weights: [],
  metrics: [],
  symptoms: [],
  food: [],
  foodEntries: [],
  water: [],
  sleep: [],
  activity: [],
  plans: [],
  insights: [],
  cards: [],
};

group('the arithmetic is done here, not by the model');

const f = facts({
  ...empty,
  food: [
    { day: '2026-09-18', kcal: 1800, protein: 90, entries: 4 },
    { day: '2026-09-19', kcal: 2000, protein: 110, entries: 5 },
  ],
});
truthy('the average is worked out', f.lines.some((l) => l.includes('1900 kcal')));
truthy('so is the protein average', f.lines.some((l) => l.includes('100 g protein')));
truthy('and how many days it rests on', f.lines.some((l) => l.includes('2 days logged')));

const sleepFacts = facts({
  ...empty,
  sleep: [
    { night: '2026-09-18', minutes: 420, quality: 'broken', awakenings: 2 },
    { night: '2026-09-19', minutes: 480, quality: 'broken', awakenings: 0 },
    { night: '2026-09-20', minutes: 450, quality: 'deep', awakenings: 1 },
  ],
});
truthy('sleep averages in hours and minutes', sleepFacts.lines.some((l) => l.includes('7h 30m')));
truthy('how the nights felt is counted', sleepFacts.lines.some((l) => l.includes('broken 2')));

const metricFacts = facts({
  ...empty,
  metrics: [
    { at: '2026-09-19', name: 'waist', value: '74 cm' },
    { at: '2026-09-12', name: 'waist', value: '75 cm' },
    { at: '2026-09-19', name: 'resting heart rate', value: '58 bpm' },
  ],
});
truthy('each measure is counted separately', metricFacts.lines.some((l) => l.startsWith('waist: 2 readings')));
truthy('and so is the other one', metricFacts.lines.some((l) => l.startsWith('resting heart rate: 1 reading,')));
truthy('one reading is not "1 readings"', !metricFacts.lines.some((l) => l.includes('1 readings')));

const movement = facts({
  ...empty,
  activity: [
    { at: '2026-09-18T09:00:00Z', what: 'ballet', minutes: 90, intensity: null },
    { at: '2026-09-18T18:00:00Z', what: 'walk', minutes: 30, intensity: null },
    { at: '2026-09-19T09:00:00Z', what: 'ballet', minutes: 60, intensity: null },
  ],
});
truthy('sessions and days are different numbers', movement.lines.some((l) => l.includes('3 sessions across 2 days')));
truthy('the total is added up here', movement.lines.some((l) => l.includes('3h in total')));
truthy('the kinds are counted', movement.lines.some((l) => l.includes('ballet 2')));

check('nothing logged means nothing but the period', facts(empty).lines.length, 1);

group('which end of the record is which');

// THE WORST BUG THIS FILE HAS HAD. loadReport returns every row OLDEST FIRST,
// so the report's own tables read forwards in time. This file read them
// backwards and announced a 4.2 kg loss as a gain - on page one, in the block
// the model is told to trust, with the guard passing it happily because both
// numbers are real. A clinician would have read the opposite of what happened.
const trend = facts({
  ...empty,
  weights: [
    { at: '2026-07-01', weight: 78.4, fat: 34.1, muscle: null },
    { at: '2026-08-01', weight: 76.0, fat: 32.6, muscle: null },
    { at: '2026-09-01', weight: 74.2, fat: 31.5, muscle: null },
  ],
});
const weightLine = trend.lines.find((l) => l.startsWith('Weight:'));
truthy('a fall is stated as a fall', weightLine.includes('from 78.4 kg') && weightLine.includes('to 74.2 kg'));
const fatLine = trend.lines.find((l) => l.startsWith('Body fat:'));
truthy('and so is a fall in body fat', fatLine.includes('from 34.1%') && fatLine.includes('to 31.5%'));

const waist = facts({
  ...empty,
  metrics: [
    { at: '2026-07-01', name: 'waist', value: '92 cm' },
    { at: '2026-08-01', name: 'waist', value: '90 cm' },
    { at: '2026-09-01', name: 'waist', value: '87 cm' },
  ],
});
truthy(
  '"most recent" is the most recent one',
  waist.lines.some((l) => l.includes('most recent 87 cm'))
);

group('an average is not allowed to be nonsense');

// 419.67 minutes floored to 6 hours and rounded to 60 minutes is "6h 60m" - a
// figure that cannot exist, in the one block whose whole job is being exact.
const awkward = facts({
  ...empty,
  sleep: [
    { night: '2026-09-18', minutes: 420, quality: null, awakenings: null },
    { night: '2026-09-19', minutes: 420, quality: null, awakenings: null },
    { night: '2026-09-20', minutes: 419, quality: null, awakenings: null },
  ],
});
truthy('no sixty-minute hour', !awkward.lines.some((l) => l.includes('60m')));
truthy('it rounds up to the hour instead', awkward.lines.some((l) => l.includes('7h')));

group('reading numbers out of prose');

check('plain', [...numbersIn('4 nights')], ['4']);
check('a thousands comma is the same number', [...numbersIn('1,850 kcal')], ['1850']);
check('a decimal survives', [...numbersIn('74.5 cm')], ['74.5']);
check('a trailing zero is not a second number', [...numbersIn('8 and 8.0')], ['8']);
check('no numbers at all', [...numbersIn('she slept badly')], []);

group('the guard: the summary states no figures at all');

// WHY THIS AND NOT A WHITELIST. The first guard kept every number the facts
// contained and dropped sentences naming anything else. A review broke it three
// ways in one afternoon, all the same flaw: a bare digit carries no meaning.
// "7 nights" licensed "7 hours a night", "woke 7 times" and "body fat around
// 7%". The records' own free text licensed more. A date in scope licensed
// almost every small integer in the language. So the division moved: the app
// prints the figures, the model writes the prose, and any figure in the prose
// goes.

check(
  'prose with no figures is untouched',
  withoutFigures('The records describe recurring swelling after long periods seated.').text,
  'The records describe recurring swelling after long periods seated.'
);

check(
  'a figure takes its sentence with it',
  withoutFigures('Swelling recurred. It was noted on 4 of the days.'),
  { text: 'Swelling recurred.', dropped: ['It was noted on 4 of the days.'] }
);

check(
  'the three the whitelist waved through are all gone now',
  withoutFigures('She slept 7 hours a night on average and woke 7 times. Body fat is around 7%.').text,
  ''
);

check(
  'a laundered percentage from a record does not survive',
  withoutFigures('Migraines affected 40% of the days in this period.').text,
  ''
);

check(
  'numbers written as words go too',
  withoutFigures('Headaches were noted on fourteen of the ninety days.').text,
  ''
);

check(
  'and so does a quantifier standing in for a count',
  withoutFigures('Most of the nights were broken.').text,
  ''
);

check(
  'a decimal cannot hide',
  withoutFigures('Her waist measured 74.5 cm.').text,
  ''
);

check(
  'a date is a figure for this purpose',
  withoutFigures('The first entry is dated 2026-09-18.').text,
  ''
);

check(
  'honest description of thinness survives, which is the point',
  withoutFigures(
    'Sleep was described on only a few of the nights, so it should not be read as a picture of usual sleep.'
  ).text,
  'Sleep was described on only a few of the nights, so it should not be read as a picture of usual sleep.'
);

group('the splitter does not mangle a sentence it keeps');

check(
  'an abbreviation is not the end of a sentence',
  withoutFigures('The entries were reviewed by Dr. Okafor and describe the same pattern.').text,
  'The entries were reviewed by Dr. Okafor and describe the same pattern.'
);

check(
  'and one before a dropped clause does not leave a dangling fragment',
  withoutFigures('Movement was logged regularly, i.e. on most weekdays.').text,
  ''
);

check(
  'two clean sentences stay two clean sentences',
  withoutFigures('Swelling recurred. It followed long periods seated.').text,
  'Swelling recurred. It followed long periods seated.'
);

group('paragraphs survive the guard');

// A blank line, without writing an escape that a shell or a JSON layer can eat.
const GAP = String.fromCharCode(10, 10);

check(
  'a blank line stays a blank line',
  withoutFigures(`Swelling recurred.${GAP}Sleep was described rarely.`).text,
  `Swelling recurred.${GAP}Sleep was described rarely.`
);

check(
  'a paragraph emptied by the guard leaves no blank gap',
  withoutFigures(`Swelling recurred.${GAP}Weight fell by 9 kg.`).text,
  'Swelling recurred.'
);

check(
  'the surviving paragraph of three keeps its place',
  withoutFigures(`A recurred.${GAP}Invented 9 kg.${GAP}C was thin.`).text,
  `A recurred.${GAP}C was thin.`
);

group('the figures the app prints are the ones it counted');

const real = facts({
  ...empty,
  food: [{ day: '2026-09-18', kcal: 1800, protein: 90, entries: 4 }],
  sleep: [{ night: '2026-09-18', minutes: 445, quality: 'broken', awakenings: 2 }],
  activity: [{ at: '2026-09-18T09:00:00Z', what: 'ballet', minutes: 90, intensity: null }],
});
truthy('they are lines meant to be read', real.lines.every((l) => l.endsWith('.')));
truthy('and they carry figures, which is why they exist', numbersIn(real.lines.join(' ')).size > 0);

console.log(`
  ${passed} passed, ${failed} failed
`);
process.exit(failed === 0 ? 0 : 1);
