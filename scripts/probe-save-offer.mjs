// Does the app ask its own question, once, about the right tab?
//
// The offer line is the app's, not the model's, because on the first voice test
// the model stored an offer and never spoke the question - leaving something
// waiting on an answer to a question nobody was asked. The risk on the other
// side is asking twice, when the model asks anyway.
//
//   npx tsx scripts/probe-save-offer.mjs

import { offerQuestion } from '../app/lib/pending-save.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)})`}`);
};

const ALMANAC = 'Want me to keep that in your Almanac?';
const ME = 'Want me to keep that in your Me tab?';

console.log('\n  THE QUESTION NAMES THE TAB\n');
check('a symptom asks about the Almanac', offerQuestion('Sore knee, noted.', 'symptom'), ALMANAC);
check('a me card asks about Me', offerQuestion('D3 through the winter, then.', 'me'), ME);
check('an unknown type falls back to the Almanac', offerQuestion('Something.'), ALMANAC);

console.log('\n  IT NEVER ASKS TWICE\n');
check(
  'the model already asked about the Almanac',
  offerQuestion('Shall I put that in your Almanac?', 'symptom'),
  null
);
check(
  'the model already asked about the Me tab',
  offerQuestion('Want that on your Me tab?', 'me'),
  null
);
check(
  'the model asked to keep it, without naming a tab',
  offerQuestion('Would you like me to keep that?', 'me'),
  null
);
check('the model asked to save it', offerQuestion('Shall I save this for you?', 'me'), null);

console.log('\n  AND IT DOES ASK WHEN THE REPLY ONLY SOUNDS LIKE A QUESTION\n');
// A question about something else must not suppress the offer: that leaves an
// offer stored and never put, which is the original bug.
check(
  'a question about the thing itself',
  offerQuestion('Are you taking it in the morning?', 'me'),
  ME
);
check(
  'a statement mentioning the Almanac',
  offerQuestion('That is already in your Almanac.', 'symptom'),
  ALMANAC
);
check('an empty reply still gets the question', offerQuestion('', 'me'), ME);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
