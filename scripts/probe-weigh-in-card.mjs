// THE WEIGH-IN CARD, AGAINST THE MORNING IT GOT WRONG.
//
// 28 September 2026. Her card read:
//
//   Weight 57 kg  ↗ +1.4 vs 6 days ago
//   Weight's edged up across your last few readings. That's more than a
//   single-day blip, so it's worth a calm look rather than a shrug or a spiral.
//   You're on your period, so some of this may settle on its own.
//
// Her readings: 56.95 that morning, 56.85 the morning before, 55.55 six days
// earlier. The day-on-day change was a hundred grams. Her reply: "Its period and
// the weekend festivities. It's nothing to be alarmed about."
//
// Two separate faults, so two separate sets of checks: which reading it compares
// against, and what it then says. Pure - no model, no database.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-weigh-in-card.mjs

import {
  findPreviousReading,
  findWeekAgoReading,
  weeklyDelta,
} from '../mobile/src/lib/overview-metrics.ts';
import { interpretLatestReading } from '../mobile/src/lib/measurement-interpretation.ts';

// Her real rows, newest first, as the app reads them.
const ROWS = [
  { measured_at: '2026-09-28T07:41:00Z', weight_kg: 56.95, body_fat_pct: 27.5, muscle_kg: 38.85 },
  { measured_at: '2026-09-27T07:58:00Z', weight_kg: 56.85, body_fat_pct: 27.4, muscle_kg: 38.83 },
  { measured_at: '2026-09-24T21:18:55Z', weight_kg: 55.5, body_fat_pct: 27, muscle_kg: 38 },
  { measured_at: '2026-09-24T07:24:00Z', weight_kg: null, body_fat_pct: null, muscle_kg: null },
  { measured_at: '2026-09-22T07:22:00Z', weight_kg: 55.55, body_fat_pct: 27.4, muscle_kg: 37.95 },
  { measured_at: '2026-09-19T07:46:00Z', weight_kg: 55.6, body_fat_pct: 27.2, muscle_kg: 38.07 },
];

const LATEST = ROWS[0];

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

console.log('\n## Which reading the card compares against\n');

const weekAgo = findWeekAgoReading(ROWS, LATEST.measured_at);
const previous = findPreviousReading(ROWS, LATEST.measured_at);

console.log(`  week-ago reference: ${weekAgo?.measured_at} (${weekAgo?.weight_kg} kg)`);
console.log(`  previous reference: ${previous?.measured_at} (${previous?.weight_kg} kg)\n`);

check(
  'the previous reading is yesterday, not six days ago',
  previous?.measured_at.startsWith('2026-09-27') === true
);
check(
  'the delta against it is 0.1, not 1.4',
  weeklyDelta(LATEST.weight_kg, previous?.weight_kg ?? null) === 0.1,
  `got ${weeklyDelta(LATEST.weight_kg, previous?.weight_kg ?? null)}`
);
check(
  'a reading with no weight is never the reference',
  previous?.weight_kg != null
);
// The Overview is a different question and must be untouched.
check(
  'the Overview still uses a week-ago reference',
  weekAgo?.measured_at.startsWith('2026-09-22') === true
);

console.log('\n## What it says, with her period and a 2,341 kcal Sunday in the record\n');

const withExplanation = interpretLatestReading({
  latest: { weightKg: 56.95, measuredAt: '2026-09-28T07:41:00Z' },
  priorWeights: [56.85, 55.5, 55.55],
  priorWeightMeasuredAts: ['2026-09-27T07:58:00Z', '2026-09-24T21:18:55Z', '2026-09-22T07:22:00Z'],
  lastPeriodStart: '2026-09-27',
  recentFoods: [
    { happenedAt: '2026-09-27T20:04:00Z', sodiumMg: null, kcal: 2068 },
    { happenedAt: '2026-09-27T11:00:48Z', sodiumMg: null, kcal: 273 },
  ],
});

console.log(`  > ${withExplanation?.message ?? '(nothing said)'}\n`);

const m = withExplanation?.message ?? '';
check('does not call it worth a calm look', !/calm look/i.test(m));
check('does not mention a shrug or a spiral', !/shrug|spiral/i.test(m));
check('does not call it more than a blip', !/single-day blip|more than a blip/i.test(m));
check('names the period', /period/i.test(m));
check('names the bigger day', /bigger|ate more|more than usual/i.test(m));
check('says a rise now is ordinary', /ordinary|expected|usual/i.test(m));
check('is one sentence, not a paragraph', (m.match(/\./g) ?? []).length <= 2, `${m.length} chars`);
check('the intake flag reached it', (withExplanation?.sources ?? []).includes('intake'));

console.log('\n## And with nothing in the record to explain it\n');

const noExplanation = interpretLatestReading({
  latest: { weightKg: 56.95, measuredAt: '2026-09-28T07:41:00Z' },
  priorWeights: [56.85, 55.5, 55.55],
  priorWeightMeasuredAts: ['2026-09-27T07:58:00Z', '2026-09-24T21:18:55Z', '2026-09-22T07:22:00Z'],
  lastPeriodStart: null,
  recentFoods: [],
});

console.log(`  > ${noExplanation?.message ?? '(nothing said)'}\n`);

const n = noExplanation?.message ?? '';
check('still says the rise is real', /edged up|more than one morning/i.test(n));
check('but tells her nothing about how to feel', !/calm look|shrug|spiral|worry|alarm/i.test(n));
check('and says the record does not explain it', /explain/i.test(n));

// A BIG DAY MUST NOT BE AN ORDINARY ONE. The flag exists to catch a pizza, not a
// Tuesday, and a bar set too low would explain away every reading she ever takes.
const ordinaryDay = interpretLatestReading({
  latest: { weightKg: 56.95, measuredAt: '2026-09-28T07:41:00Z' },
  priorWeights: [56.85, 55.5, 55.55],
  priorWeightMeasuredAts: ['2026-09-27T07:58:00Z', '2026-09-24T21:18:55Z', '2026-09-22T07:22:00Z'],
  lastPeriodStart: null,
  recentFoods: [{ happenedAt: '2026-09-27T18:00:00Z', sodiumMg: null, kcal: 1400 }],
});
console.log('');
check(
  'an ordinary 1,400 kcal day does not trip the intake flag',
  !(ordinaryDay?.sources ?? []).includes('intake')
);

console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
