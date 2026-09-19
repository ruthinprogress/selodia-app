// Is a longer version of a spoken sentence recognised as the same sentence?
//
// Shaped on 2026-09-19, when one day's food, spoken once, went in as five rows.
// Generic foods here. Pure, no API, free to run.
//
//   npx tsx scripts/probe-voice-supersede.mjs

import { continues } from '../app/lib/voice-supersede.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${got}, wanted ${want})`}`);
};

const A = 'For breakfast I had porridge with blueberries and a coffee and- sorry.';
const B = 'For breakfast I had porridge with blueberries and a coffee and, um, a banana.';
const C = B + ' And then for lunch I had a tuna sandwich.';

console.log('\n  THE SAME SENTENCE, CARRIED ON\n');
check('a revised ending, longer, is the same sentence', continues(A, B), true);
check('lunch added on is the same sentence', continues(B, C), true);
check('punctuation and case do not matter', continues('for BREAKFAST, i had porridge', 'For breakfast I had porridge, and toast'), true);
check('a two-word turn carried on', continues('Two eggs', 'Two eggs on toast'), true);

console.log('\n  NOT THE SAME SENTENCE\n');
check('a different opening', continues(B, 'For lunch I had a tuna sandwich and an apple and a coffee'), false);
check('the same words again is a replay, not a continuation', continues(B, B), false);
check('shorter is never a continuation', continues(C, B), false);
check('a new short answer after hearing the reply', continues(B, 'Okay.'), false);
check('empty earlier turn', continues('', 'Anything at all'), false);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
