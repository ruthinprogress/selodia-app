// Is this Almanac save the one that was just made, again?
//
// Built from her own library on 2026-09-19: "Barbell Bent Over Row - Strength"
// three times in 13 seconds, "Side Splits Stretch Program" twice in under one,
// "Full-Body Barbell Strength Plan" twice in 32. Pure function, no API.
//
//   npx tsx scripts/probe-almanac-same-entry.mjs

import { findSameEntry } from '../app/lib/almanac.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

const recent = [
  { id: 'row', kind: 'movement plan', title: 'Barbell Bent Over Row - Strength' },
  { id: 'fb', kind: 'movement plan', title: 'Full-Body Barbell Strength Plan' },
  { id: 'd3', kind: 'me', title: 'Vitamin D3' },
];
const idOf = (kind, title) => findSameEntry({ kind, title }, recent)?.id ?? null;

console.log('\n  THE SAME ENTRY, SAVED AGAIN\n');
check('the exact title', idOf('movement plan', 'Barbell Bent Over Row - Strength'), 'row');
check('punctuation and case', idOf('Movement Plan', 'barbell bent-over row: strength'), 'row');
check('the Full-Body correction', idOf('movement plan', 'Full-Body Barbell Strength Plan'), 'fb');

console.log('\n  NOT THE SAME ENTRY\n');
check('a different title', idOf('movement plan', 'Side Splits Progression'), null);
// Same words, different tab: a Me card and a plan are different things even
// when somebody names them alike.
check('same title, different kind', idOf('movement plan', 'Vitamin D3'), null);
check('an empty title', idOf('movement plan', ''), null);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
