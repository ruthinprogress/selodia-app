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

import { facts, numbersIn, withoutInvention } from '../app/lib/report-summary.ts';

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

group('reading numbers out of prose');

check('plain', [...numbersIn('4 nights')], ['4']);
check('a thousands comma is the same number', [...numbersIn('1,850 kcal')], ['1850']);
check('a decimal survives', [...numbersIn('74.5 cm')], ['74.5']);
check('a trailing zero is not a second number', [...numbersIn('8 and 8.0')], ['8']);
check('no numbers at all', [...numbersIn('she slept badly')], []);

group('the guard: an invented figure takes its sentence with it');

const allowed = new Set(['2', '1900', '100']);

check(
  'a summary that stays inside the facts is untouched',
  withoutInvention('Two days were logged, averaging 1900 kcal.', allowed).text,
  'Two days were logged, averaging 1900 kcal.'
);

check(
  'a figure that was never counted is dropped',
  withoutInvention(
    'Two days were logged. Her intake averaged 2400 kcal across the week.',
    allowed
  ),
  { text: 'Two days were logged.', dropped: ['Her intake averaged 2400 kcal across the week.'] }
);

check(
  'the whole sentence goes, not just the number',
  withoutInvention('Sleep averaged 6.5 hours, which is below the usual range.', allowed).text,
  ''
);

check(
  'several inventions, several drops',
  withoutInvention('A is 1900. B is 77. C is 100. D is 3.', allowed).dropped,
  ['B is 77.', 'D is 3.']
);

check(
  'a number quoted from the records is allowed',
  withoutInvention('The entry of 2026-09-18 describes a headache.', allowed, new Set(['2026', '9', '18'])).text,
  'The entry of 2026-09-18 describes a headache.'
);

check(
  'prose with no numbers always passes',
  withoutInvention('The records describe recurring headaches and broken sleep.', new Set()).text,
  'The records describe recurring headaches and broken sleep.'
);

check(
  'a summary that is entirely invented comes back empty',
  withoutInvention('Weight fell 3 kg. Protein rose to 130 g.', allowed).text,
  ''
);

group('the figures a real summary would draw on all pass their own guard');

const real = facts({
  ...empty,
  food: [{ day: '2026-09-18', kcal: 1800, protein: 90, entries: 4 }],
  sleep: [{ night: '2026-09-18', minutes: 445, quality: 'broken', awakenings: 2 }],
  activity: [{ at: '2026-09-18T09:00:00Z', what: 'ballet', minutes: 90, intensity: null }],
});
const quoted = real.lines.join(' ');
check(
  'every number the facts state survives a check against themselves',
  withoutInvention(quoted, real.numbers).dropped,
  []
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
