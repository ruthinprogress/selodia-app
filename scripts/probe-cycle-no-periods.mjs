// WHAT DOES THE APP SAY TO SOMEBODY WHOSE PERIODS HAVE STOPPED?
//
// Selodia is for women over 40. A good share of them are post-menopausal, on
// HRT, or have irregular cycles. The cycle code takes the last logged period
// and counts days forward, and nothing bounds the count. This runs the real
// functions over the real cases rather than reasoning about them.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-cycle-no-periods.mjs

import { buildCycleContextPrompt, computeCycleDayAndPhase } from '../app/lib/cycle.ts';

const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const CASES = [
  ['a regular cycle, day 8', ago(7)],
  ['a long cycle, 40 days - common in perimenopause', ago(39)],
  ['a skipped period, 70 days', ago(69)],
  ['periods stopped a year ago', ago(365)],
  ['post-menopause, last period two years ago', ago(730)],
  ['post-menopause, five years ago', ago(1825)],
];

for (const [name, when] of CASES) {
  const info = computeCycleDayAndPhase(when);
  console.log(`\n  ${name}`);
  console.log(`    computed: day ${info?.cycleDay}, ${info?.phase} phase`);
  const block = buildCycleContextPrompt(when);
  console.log(`    told to the model: ${block ? block.slice(0, 150) + (block.length > 150 ? '…' : '') : '(nothing)'}`);
}
