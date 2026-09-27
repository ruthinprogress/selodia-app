// The roundup card's rows, against the week that produced the reply she reported.
//
// Every figure in that reply was wrong - "a week of higher intake, sitting under
// 1,400 kcal on average" over 1,222 kcal, "almost no movement to speak of" over a
// run and a yoga session and a 9,820-step day, "your 10 readings" over three. The
// rows are worked out in code now, so this checks the code rather than the
// wording: same week, and each row has to say the true thing.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-roundup-figures.mjs

import { roundupFigures } from '../app/lib/roundup-figures.ts';

const CASES = [
  {
    what: 'The week she was shown, 21 to 27 September',
    input: {
      fullDays: 5,
      avgKcal: { value: 1222, confidence: 'over the 5 days with a log' },
      avgProtein: { value: 70, confidence: null },
      delta: {
        first: { value: 65.1, date: '2026-09-21' },
        last: { value: 64.2, date: '2026-09-25' },
        change: -0.9,
        readingCount: 3,
      },
      readingCount: 3,
      activity: [
        { activity_type: 'yoga', duration_min: 45, intensity: 'light' },
        { activity_type: 'run', duration_min: 32, intensity: 'moderate' },
      ],
      drinkDayTotals: [1800, 1500, 1900, 1525],
      stepDays: [7610, 9940, 6890, 2262, 8420, 9820, 3863],
    },
    checks: [
      ['food row says 1,222 and not 1,400', (r) => /1,222/.test(r.Food) && !/1,400/.test(r.Food)],
      ['food row says it covers 5 days, not the week', (r) => /5 of 7/.test(r.Food)],
      ['movement names what she did', (r) => /yoga/.test(r.Movement) && /run/.test(r.Movement)],
      ['movement is never called none', (r) => !/no sessions|nothing/i.test(r.Movement)],
      ['steps are their own row', (r) => /\d,\d{3}/.test(r.Steps)],
      ['weigh-ins lead with the count 3', (r) => /^3,/.test(r['Weigh-ins'])],
      ['weigh-ins never say ten', (r) => !/\b10\b|ten/i.test(r['Weigh-ins'])],
      ['drinks say how many days', (r) => /4 of 7/.test(r.Drinks)],
    ],
  },
  {
    what: 'A week with nothing in it at all',
    input: {
      fullDays: 0,
      avgKcal: null,
      avgProtein: null,
      delta: null,
      readingCount: 0,
      activity: [],
      drinkDayTotals: [],
      stepDays: [],
    },
    checks: [
      // EVERY ROW IS STILL THERE. A card with no sleep row reads as a card that
      // does not track sleep; a row saying nothing logged reads as the truth. Same
      // rule as turn-facts.ts, and the reason is the invented workout.
      ['all five rows present', (r) => Object.keys(r).length === 5],
      ['food says nothing logged', (r) => /nothing logged/i.test(r.Food)],
      ['movement says no sessions', (r) => /no sessions/i.test(r.Movement)],
      ['no row is blank', (r) => Object.values(r).every((v) => v.trim().length > 0)],
      ['no row invents a number', (r) => !Object.values(r).some((v) => /\d/.test(v))],
    ],
  },
  {
    what: 'One reading, which is a position and not a change',
    input: {
      fullDays: 7,
      avgKcal: { value: 1850, confidence: null },
      avgProtein: { value: 88, confidence: null },
      delta: null,
      readingCount: 1,
      activity: [{ activity_type: 'walk', duration_min: 60, intensity: 'light' }],
      drinkDayTotals: [2000, 2100, 1800, 1950, 2050, 1900, 2000],
      stepDays: [8000, 8200, 7900, 8100, 8300, 8050, 7950],
    },
    checks: [
      ['says position rather than change', (r) => /position rather than a change/i.test(r['Weigh-ins'])],
      ['no minus sign anywhere', (r) => !Object.values(r).some((v) => /-\d/.test(v))],
      ['a full food week carries no caveat', (r) => !/not the week/.test(r.Food)],
      ['a full step week carries no caveat', (r) => !/recorded on/.test(r.Steps)],
    ],
  },
];

let failed = 0;

for (const c of CASES) {
  const rows = roundupFigures(c.input);
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, `${r.value}${r.note ? ` (${r.note})` : ''}`]));

  console.log(`\n## ${c.what}\n`);
  for (const r of rows) {
    console.log(`  ${r.label.padEnd(11)} ${r.value}${r.note ? `\n              (${r.note})` : ''}`);
  }
  console.log('');
  for (const [name, test] of c.checks) {
    let ok = false;
    try {
      ok = test(byLabel);
    } catch {
      ok = false;
    }
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
}

console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
