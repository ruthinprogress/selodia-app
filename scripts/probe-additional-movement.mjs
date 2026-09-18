// What counts as one added movement, and what is just the way people talk?
//
// For Ruth's third kind of information (2026-09-18): "planned movement
// completed, planned movement adapted, and additional movement not originally in
// the routine". Pure function, no API, free to run.
//
//   npx tsx scripts/probe-additional-movement.mjs

import { splitAdditional } from '../mobile/src/lib/additional-movement.ts';

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

console.log('\n  HER OWN EXAMPLES\n');
check('one thing', splitAdditional('Added 3×10 box jumps.'), ['3×10 box jumps']);
check('a duration', splitAdditional('I added 20 minutes of climbing.'), ['20 minutes of climbing']);
check('a finisher', splitAdditional('Finished with stretching.'), ['stretching']);
check(
  'the sentence she actually said',
  splitAdditional('box jumps 3 x 10, ballet hip pulses 2 x 40 each side'),
  ['box jumps 3 x 10', 'ballet hip pulses 2 x 40 each side']
);

console.log('\n  SEPARATORS\n');
check('line breaks', splitAdditional('box jumps\nclimbing\nstretching'), [
  'box jumps',
  'climbing',
  'stretching',
]);
check('semicolons', splitAdditional('box jumps; climbing'), ['box jumps', 'climbing']);

console.log('\n  WHAT IS NOT A MOVEMENT\n');
check('nothing said', splitAdditional(''), []);
check('whitespace', splitAdditional('   \n  '), []);
check('a fragment too short to name anything', splitAdditional('ok, a'), []);

console.log('\n  IT KEEPS HER WORDS\n');
// No tidying into a prescription: "each side" and the ×40 are the record.
check(
  'numbers and qualifiers survive',
  splitAdditional('ballet hip pulses with leg in second pushing up a medicine ball 2 x 40 each side'),
  ['ballet hip pulses with leg in second pushing up a medicine ball 2 x 40 each side']
);

console.log('\n  A LIST THAT IS REALLY PROSE\n');
const many = splitAdditional(Array.from({ length: 20 }, (_, i) => `movement ${i}`).join(','));
check('capped rather than swallowed whole', many.length, 8);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
