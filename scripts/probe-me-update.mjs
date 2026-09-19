// "I've stopped taking magnesium" - which card, and what does it become?
//
// Changing somebody's own protocol on the strength of a sentence, so the
// matching errs towards asking. Stopping the wrong supplement in her record is
// exactly the kind of quiet error this app exists not to make. Pure functions,
// no API, free to run.
//
//   npx tsx scripts/probe-me-update.mjs

import { applyChange, findMeCard, meUpdateNote } from '../app/lib/me-update.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`
  );
};

const cards = [
  { id: 'd3', title: 'Vitamin D3', content: { status: 'Taking' } },
  { id: 'mg', title: 'Magnesium glycinate', content: { status: 'Taking' } },
  { id: 'pm', title: 'Evening skincare', content: {} },
  { id: 'am', title: 'Morning skincare', content: {} },
  { id: 'fee', title: 'Weekly call with Fee', content: { status: 'Active' } },
];
const idOf = (said) => {
  const r = findMeCard(said, cards);
  return r && r !== 'ambiguous' ? r.id : r;
};

console.log('\n  FINDING THE CARD SHE MEANS\n');
check('the exact title', idOf('Vitamin D3'), 'd3');
check('case and punctuation', idOf('vitamin d3!'), 'd3');
check('a word from the title', idOf('magnesium'), 'mg');
check('the title inside a longer phrase', idOf('my evening skincare'), 'pm');
check('the call with Fee', idOf('weekly call with fee'), 'fee');

console.log('\n  WHEN IT MUST ASK INSTEAD\n');
// "skincare" is both routines. Pausing one of them on a guess is the error.
check('two cards could be it', idOf('skincare'), 'ambiguous');
check('nothing like it', idOf('fish oil'), null);
check('nothing said', idOf(''), null);

console.log('\n  WHAT THE CARD BECOMES\n');
const paused = applyChange(
  { section: 'Supplements', why: 'For sleep.', status: 'Taking' },
  { status: 'Paused', reason: "it wasn't helping", date: '2026-09-19' }
);
check('the status changes', paused.status, 'Paused');
check('the why is untouched', paused.why, 'For sleep.');
check(
  'the history starts where it began, then records the change',
  paused.history,
  [
    { date: '', status: 'Taking', reason: null },
    { date: '2026-09-19', status: 'Paused', reason: "it wasn't helping" },
  ]
);

// Taken again later: appended, never rewritten, so the card can tell the whole
// story - and not repeat the experiment that already failed.
const again = applyChange(paused, { status: 'Taking', reason: 'trying a lower dose', date: '2026-11-02' });
check('the history grows rather than being rewritten', again.history.length, 3);
check('the latest status wins', again.status, 'Taking');

console.log('\n  WHAT SHE IS TOLD\n');
check(
  'a change',
  meUpdateNote({ kind: 'updated', title: 'Magnesium glycinate', status: 'Paused' }),
  'Updated in your Me tab: Magnesium glycinate is now Paused.'
);
check(
  'an ambiguous one asks which',
  meUpdateNote({ kind: 'ambiguous', said: 'skincare' }).includes('Which one did you mean?'),
  true
);
check(
  'a missing one says nothing changed',
  meUpdateNote({ kind: 'not_found', said: 'fish oil' }).includes('nothing has changed'),
  true
);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
