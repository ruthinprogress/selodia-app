// The list that decides which measurements somebody sees, and what it says
// about each one.
//
//   node scripts/probe-tracked-metrics.mjs
//
// WHY THIS EXISTS. Ruth's item 11 replaces three hardcoded columns and a
// second hardcoded table with a list the person owns. Everything the
// Measurements screen draws now comes through here, so a mistake in it is a
// mistake in every number on that screen - and two of the rules are exactly
// the kind that look obviously right and are silently wrong:
//
//   - a metric recorded for the first time TOMORROW has to appear without
//     anybody going back to settings, or the settings screen becomes a thing
//     you must remember.
//   - a stored entry naming something that no longer exists must be ignored
//     rather than drawn empty.
//
// Those are the same two rules the Log's layout has, and they were worth a
// probe there too.
//
// Touches no database and no account.

import {
  changeLabel,
  formatMetricValue,
  readTrackedMetrics,
  readingsFor,
  resolveTrackedMetrics,
} from '../mobile/src/lib/tracked-metrics.ts';

let failed = 0;
const check = (name, got, expected) => {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name}`);
  if (!ok) {
    console.log(`          got      ${JSON.stringify(got)}`);
    console.log(`          expected ${JSON.stringify(expected)}`);
  }
};

console.log('\n  WHICH MEASUREMENTS SOMEBODY TRACKS\n');

// ---- the default list -------------------------------------------------
const labels = (list) => list.map((m) => m.label);

check(
  'nothing stored, nothing personal: the scale three, in reading order',
  labels(resolveTrackedMetrics(null, [])),
  ['Weight', 'Body fat', 'Muscle']
);

check(
  'nothing stored: personal metrics follow the scale ones',
  labels(resolveTrackedMetrics(null, [{ name: 'waist', unit: 'cm' }, { name: 'thighs', unit: 'cm' }])),
  ['Weight', 'Body fat', 'Muscle', 'Waist', 'Thighs']
);

// AND THE UNIT COMES WITH IT. Leaving it empty here made the settings list
// print "Waist - no unit" beside a Measurements screen reading "79 cm". The
// first spelling still wins, so the label is the person's own, but a unit from
// a later row fills a gap an earlier one left.
check(
  'a name recorded twice appears once, and picks up its unit',
  resolveTrackedMetrics(null, [{ name: 'waist' }, { name: 'Waist ', unit: 'cm' }, { name: 'waist' }])
    .filter((m) => m.source === 'personal')
    .map((m) => `${m.label} in ${m.unit || 'nothing'}`),
  ['Waist in cm']
);

// ---- her order is kept, and new things still arrive -------------------
const hers = [
  { key: 'personal:waist', label: 'Waist', unit: 'cm', icon: 'resize-outline', source: 'personal', name: 'waist' },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'speedometer-outline', source: 'scale', field: 'weight_kg' },
];

check(
  'her order is honoured exactly',
  labels(resolveTrackedMetrics(hers, [{ name: 'waist', unit: 'cm' }])).slice(0, 2),
  ['Waist', 'Weight']
);

check(
  'a metric she records TOMORROW appears at the end, unasked',
  labels(resolveTrackedMetrics(hers, [{ name: 'waist', unit: 'cm' }, { name: 'calf', unit: 'cm' }])).includes('Calf'),
  true
);

check(
  'the scale metrics she has not listed are still offered, after hers',
  labels(resolveTrackedMetrics(hers, [{ name: 'waist', unit: 'cm' }])),
  ['Waist', 'Weight', 'Body fat', 'Muscle']
);

// ---- what a stored value is allowed to be -----------------------------
check('a stored non-array is no list', readTrackedMetrics({ nope: 1 }), null);
check('an empty array is no list', readTrackedMetrics([]), null);
check(
  'an entry with no key is dropped',
  readTrackedMetrics([{ label: 'Waist', source: 'personal', name: 'waist' }]),
  null
);
check(
  'a scale entry naming no column is dropped',
  readTrackedMetrics([{ key: 'x', label: 'X', source: 'scale' }]),
  null
);
check(
  'a scale entry naming a column that is not one is dropped',
  readTrackedMetrics([{ key: 'x', label: 'X', source: 'scale', field: 'shoe_size' }]),
  null
);
// NO ICON IN THE STORED SHAPE ANY MORE. A metric's mark is derived from its
// name - see metric-mark.tsx - so there is nothing to store and nothing that
// can be stored wrongly. An `icon` saved by an older build is simply ignored.
check(
  'a good entry survives, with its gaps filled and no icon',
  readTrackedMetrics([
    { key: 'weight', label: 'Weight', source: 'scale', field: 'weight_kg', icon: 'whatever-outline' },
  ]),
  [
    {
      key: 'weight',
      label: 'Weight',
      unit: '',
      source: 'scale',
      field: 'weight_kg',
      name: undefined,
      hidden: false,
    },
  ]
);

// ---- reading the values ------------------------------------------------
const SCALE = [
  { measured_at: '2026-09-25T08:13:00Z', weight_kg: 64.2, body_fat_pct: 27.8, muscle_kg: null },
  { measured_at: '2026-09-24T08:00:00Z', weight_kg: 64.4, body_fat_pct: 27.9, muscle_kg: 38.2 },
];
const PERSONAL = [
  { metric_name: 'waist', value: 79, unit: 'cm', measured_at: '2026-09-25T08:15:00Z', created_at: '' },
  { metric_name: 'Waist', value: 80, unit: 'cm', measured_at: '2026-09-21T07:45:00Z', created_at: '' },
];

const weight = { key: 'weight', label: 'Weight', unit: 'kg', icon: '', source: 'scale', field: 'weight_kg' };
const muscle = { key: 'muscle', label: 'Muscle', unit: 'kg', icon: '', source: 'scale', field: 'muscle_kg' };
const waist = { key: 'personal:waist', label: 'Waist', unit: 'cm', icon: '', source: 'personal', name: 'waist' };

check(
  'a scale metric reads newest first',
  readingsFor(weight, SCALE, PERSONAL).map((r) => r.text),
  ['64.2 kg', '64.4 kg']
);

check(
  'a null column is not a reading of nought',
  readingsFor(muscle, SCALE, PERSONAL).map((r) => r.text),
  ['38.2 kg']
);

check(
  'a personal metric matches its name whatever the capitals',
  readingsFor(waist, SCALE, PERSONAL).map((r) => r.text),
  ['79 cm', '80 cm']
);

check('the percent sits on its number', formatMetricValue(27.84, '%'), '27.8%');
check('a unit gets its space', formatMetricValue(64.24, 'kg'), '64.2 kg');
check('no unit, no space', formatMetricValue(12, ''), '12');

// ---- the change since the previous entry -------------------------------
check(
  'one reading has nothing to compare with, and says nothing',
  changeLabel(readingsFor(muscle, SCALE, PERSONAL), 'kg'),
  null
);
check(
  'kg changes read as a percentage',
  changeLabel(readingsFor(weight, SCALE, PERSONAL), 'kg'),
  '−0.3%'
);
check(
  'cm changes read in centimetres, because a centimetre is a thing you can picture',
  changeLabel(readingsFor(waist, SCALE, PERSONAL), 'cm'),
  '−1 cm'
);
// THE BUG THIS MISSED THE FIRST TIME. Above, the metric is handed 'cm' as its
// unit - but a metric DERIVED from what somebody has recorded carries no unit
// at all, because the unit is on each row. Asking the list gave '' and a pair
// of thighs measured in centimetres printed "-0.9%". The reading's own unit
// decides now, and this is that case: no unit on the metric, cm on the rows.
const derivedWaist = { key: 'personal:waist', label: 'Waist', unit: '', icon: '', source: 'personal', name: 'waist' };
check(
  'a metric with no unit of its own still reads its rows in centimetres',
  changeLabel(readingsFor(derivedWaist, SCALE, PERSONAL)),
  '−1 cm'
);
check(
  'no change says so rather than showing a nought',
  changeLabel([{ value: 5, text: '', at: 'b', unit: 'kg' }, { value: 5, text: '', at: 'a', unit: 'kg' }]),
  'no change'
);

console.log(failed === 0 ? '\n  all cases pass\n' : `\n  ${failed} FAILED\n`);
process.exit(failed === 0 ? 0 : 1);
