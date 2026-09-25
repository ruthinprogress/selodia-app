// Does the sentence under the Health Flower tell the truth about the week?
//
//   node scripts/probe-week-observation.mjs
//
// WHY THIS EXISTS. The first version of weekObservation() asked only whether
// the leading dimension was clear of the runner-up, and so called a week
// "fairly evenly spread" when strength was full and flexibility was nearly
// empty - because those two happened to sit next to each other in the ranking.
// It was caught by looking at the screenshot beside the sentence, which is not
// a method. A line the app PRINTS about somebody's own week is a claim, and a
// claim gets a test.
//
// Touches no database and no account: six numbers in, one sentence out.

import { weekObservation } from '../mobile/src/lib/health-flower.ts';

const w = (strength, cardio, flexibility, balance, bone, recovery) => ({
  strength,
  cardio,
  flexibility,
  balance,
  bone,
  recovery,
});

const CASES = [
  {
    name: 'nothing logged says nothing at all',
    coverage: w(0, 0, 0, 0, 0, 0),
    expect: null,
  },
  {
    name: 'every dimension full is the bloom, not a leader',
    coverage: w(100, 100, 100, 100, 100, 100),
    expect: 'All six have had your attention.',
  },
  {
    name: 'all six genuinely close is evenly spread',
    coverage: w(42, 40, 38, 41, 39, 43),
    expect: 'Your week has been fairly evenly spread.',
  },
  {
    // The bug. The top two are within a point of each other and the lowest is
    // nearly empty: this is not an even week by any reading.
    name: 'a close top two over an empty flexibility is NOT evenly spread',
    coverage: w(80, 79, 4, 30, 25, 20),
    expect: 'Strength and Cardio have had most of your attention.',
  },
  {
    name: 'one clear leader is named',
    coverage: w(90, 30, 20, 25, 15, 22),
    expect: 'Strength has had most of your attention.',
  },
  {
    name: 'two tied leaders are both named',
    coverage: w(70, 20, 15, 68, 10, 12),
    expect: 'Strength and Balance have had most of your attention.',
  },
  {
    // The second bug, and the same untruth as the first reached from the other
    // side. This is the store account's real week: three dimensions full, one
    // at little over half. Three joint leaders used to fall back to "fairly
    // evenly spread", which is false of a 43-point range.
    name: 'three tied at the top over a low sixth is NOT evenly spread',
    coverage: w(100, 83, 57, 78, 100, 100),
    expect: 'Strength, Bone and Recovery have had most of your attention.',
  },
  {
    name: 'three tied at the top, all three named',
    coverage: w(70, 68, 5, 66, 8, 6),
    expect: 'Strength, Cardio and Balance have had most of your attention.',
  },
  {
    name: 'four or more joint leaders are not recited',
    coverage: w(90, 88, 10, 87, 86, 12),
    expect: 'Most of the six have had your attention.',
  },
  {
    name: 'one dimension alone still names it',
    coverage: w(0, 0, 0, 0, 0, 55),
    expect: 'Recovery has had most of your attention.',
  },
  {
    // Nothing here is a recommendation, ever. Checked as a rule rather than
    // read case by case: ACKNOWLEDGE, DO NOT EVALUATE.
    name: 'no sentence ever suggests, praises or scolds',
    coverage: null,
  },
];

console.log('\n  THE SENTENCE UNDER THE WHEEL\n');
let failed = 0;

for (const c of CASES) {
  if (c.coverage === null) continue;
  const got = weekObservation(c.coverage);
  const ok = got === c.expect;
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${c.name}`);
  if (!ok) {
    console.log(`          got      ${JSON.stringify(got)}`);
    console.log(`          expected ${JSON.stringify(c.expect)}`);
  }
}

// The tone rule, over every sentence the function can produce.
const BANNED = /\b(should|try|add|aim|need|must|well done|great|keep it up|behind|missed|goal)\b/i;
const everySentence = CASES.filter((c) => c.coverage).map((c) => weekObservation(c.coverage));
const offending = everySentence.filter((s) => s && BANNED.test(s));
if (offending.length) {
  failed++;
  console.log('  FAIL  a sentence suggests, praises or scolds');
  for (const s of offending) console.log(`          ${s}`);
} else {
  console.log('  pass  no sentence suggests, praises or scolds');
}

console.log(failed === 0 ? '\n  all cases pass\n' : `\n  ${failed} FAILED\n`);
process.exit(failed === 0 ? 0 : 1);
