// DOES THE REFERENCE LAYER SLOW A TURN DOWN? MEASURE IT, DO NOT CLAIM IT.
//
//   node --import ./scripts/ts-paths.mjs scripts/bench-clinical-reference.mjs
//
// Ruth's condition, 30 September 2026: the app should know this "without
// slowing it down, especially the Claude interpretation layer".
//
// I said in reply that keyword matching over a few hundred entries costs
// nothing next to a model call. That is a claim, and this session has already
// turned up two things I asserted without testing - that the machine could not
// run the app, and that a waist reading had never saved. So it gets measured.
//
// AT FULL SIZE, ON SYNTHETIC ENTRIES. ENTRIES is empty and will stay empty
// until a clinician has read real ones, so this builds a set the size the real
// one will be and matches against it. The entries are nonsense on purpose -
// what is being measured is the machinery, and inventing plausible-sounding
// menopause facts to benchmark against is exactly the thing the gate exists to
// stop.

import { referenceFor, referenceBlock, MAX_ENTRIES_PER_TURN } from '../app/lib/clinical-reference.ts';

const ENTRY_COUNT = 400;
const TURNS = 20000;

// A set the shape and size of the real one. Two or three patterns each, which
// is what a real entry carries.
const synthetic = Array.from({ length: ENTRY_COUNT }, (_, i) => ({
  id: `synthetic-${i}`,
  topic: 'menopause',
  match: [
    new RegExp(`\\bterm${i}\\b`, 'i'),
    new RegExp(`\\bphrase ${i} here\\b`, 'i'),
    new RegExp(`\\bsomething else ${i}\\b`, 'i'),
  ],
  fact: `Synthetic statement number ${i}, about the length a real one would be, give or take a clause.`,
  source: {
    name: 'Synthetic',
    document: `Benchmark set, entry ${i}`,
    url: 'https://example.invalid/',
    checked: '2026-09-30',
  },
  reviewed: true,
}));

// The real matcher, against the synthetic set. Mirrors referenceFor exactly -
// if that function changes shape this benchmark stops being about it, which is
// why the assertion at the bottom checks the real one still behaves.
function matchAgainst(entries, text, limit = MAX_ENTRIES_PER_TURN) {
  const found = [];
  for (const entry of entries) {
    if (!entry.reviewed) continue;
    if (entry.match.some((re) => re.test(text))) {
      found.push(entry);
      if (found.length >= limit) break;
    }
  }
  return found;
}

// Three shapes of turn: one that matches nothing (the common case, and the
// WORST case for the matcher, because it has to try every pattern); one that
// matches late; one that matches early and stops.
const TURN_TEXTS = [
  'Porridge and blueberries this morning, and I slept badly again',
  `I have been getting hot flushes and something else ${ENTRY_COUNT - 3} keeps happening`,
  `term0 is what I wanted to ask about`,
];

const results = [];
for (const text of TURN_TEXTS) {
  // Warm the JIT, or the first numbers measure compilation rather than work.
  for (let i = 0; i < 2000; i += 1) matchAgainst(synthetic, text);

  const started = process.hrtime.bigint();
  let hits = 0;
  for (let i = 0; i < TURNS; i += 1) {
    const found = matchAgainst(synthetic, text);
    hits += found.length;
    referenceBlock(found);
  }
  const ns = Number(process.hrtime.bigint() - started);
  results.push({
    text: text.slice(0, 44) + (text.length > 44 ? '…' : ''),
    perTurnMicros: ns / TURNS / 1000,
    matched: hits / TURNS,
  });
}

console.log(`\n  ${ENTRY_COUNT} entries, ${TURNS.toLocaleString()} turns each\n`);
for (const r of results) {
  console.log(
    `  ${r.perTurnMicros.toFixed(1).padStart(7)} µs/turn   ${r.matched.toFixed(1)} matched   "${r.text}"`
  );
}

const worst = Math.max(...results.map((r) => r.perTurnMicros));
console.log(`\n  Worst case: ${worst.toFixed(1)} µs per turn.`);

// FOR SCALE, and this is the number that answers her question. A Haiku classify
// call and a Sonnet write call are the turn; they are measured in seconds.
const MODEL_CALL_MS = 1500;
console.log(
  `  A model call on this path is roughly ${MODEL_CALL_MS} ms, so this is about ` +
    `1/${Math.round((MODEL_CALL_MS * 1000) / worst).toLocaleString()} of one.`
);

// AND THE GATE IS STILL SHUT. The benchmark must never be the thing that opens
// it, so the real function is called here and must return nothing at all.
const live = referenceFor('hot flushes and HRT and perimenopause');
if (live.length !== 0) {
  console.error('\n  THE LAYER IS LIVE. referenceFor returned entries with the gate supposedly shut.\n');
  process.exit(1);
}
console.log('  The real layer returned 0 entries: the gate is shut, as it should be.\n');

if (worst > 2000) {
  console.error(`  TOO SLOW: ${worst.toFixed(0)} µs per turn is no longer negligible.`);
  process.exit(1);
}
