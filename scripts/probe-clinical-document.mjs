// A RECORD THAT REPLACES THE LETTER.
//
// Ruth's condition for keeping only a summary: "it needs to keep the
// information that makes the letter not needed, so insurance numbers and all of
// the details that can make the thread verifiable on a phone call or visit to a
// clinic ... You should be able to ask selodia: I've been having weird symptoms
// in x again, can you remind me how to get seen?"
//
// So these checks are about the parts she will read out loud, and about the one
// guard that can exist here: a number is confirmed only when two independent
// readings of the page agreed on it.
//
//   npx tsx scripts/probe-clinical-document.mjs

import { confirmReferences, sameValue } from '../app/lib/clinical-document.ts';
import { cardBody, cardSection, offerLine } from '../app/lib/clinical-card.ts';

let passed = 0;
let failed = 0;

function group(name) {
  console.log(`\n  ${name.toUpperCase()}\n`);
}

function check(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        got  ${a}`);
    console.log(`        want ${b}`);
  }
}

function truthy(name, value) {
  check(name, Boolean(value), true);
}

group('two readings of the same number');

truthy('spacing on a page is noise', sameValue('123 456 7890', '1234567890'));
truthy('so are dashes and dots', sameValue('RX-4471.02', 'RX447102'));
truthy('and case', sameValue('ab12cd', 'AB12CD'));
check('a digit is never noise', sameValue('1234567890', '1234567891'), false);
check('nor is a missing one', sameValue('123456789', '1234567890'), false);
check('nor a transposition', sameValue('123456', '124356'), false);

group('what confirmReferences keeps, and how it marks it');

const agreed = confirmReferences(
  [{ label: 'NHS number', value: '485 777 3456' }],
  [{ label: 'NHS number', value: '4857773456' }]
);
check('agreement across two readings is confirmed', agreed, [
  { label: 'NHS number', value: '485 777 3456', confirmed: true },
]);

const disagreed = confirmReferences(
  [{ label: 'Hospital number', value: 'RX447102' }],
  [{ label: 'Hospital number', value: 'RX447702' }]
);
check('a disagreement is KEPT, and marked', disagreed, [
  { label: 'Hospital number', value: 'RX447102', confirmed: false },
]);

// WHY KEPT RATHER THAN DROPPED. A half-read hospital number she can check
// against the letter beats a blank space, and she still has the letter at the
// moment the card is made - which is exactly when the mark is useful.
truthy('because a blank is less use than something to check', disagreed.length === 1);

const onlySecond = confirmReferences(
  [{ label: 'NHS number', value: '4857773456' }],
  [
    { label: 'NHS number', value: '4857773456' },
    { label: 'Appointment ref', value: 'APP-99213' },
  ]
);
check('a detail only the second reading saw is offered, unconfirmed', onlySecond, [
  { label: 'NHS number', value: '4857773456', confirmed: true },
  { label: 'Appointment ref', value: 'APP-99213', confirmed: false },
]);

check(
  'the same number twice in one reading is once',
  confirmReferences(
    [
      { label: 'NHS number', value: '4857773456' },
      { label: 'NHS number', value: '4857773456' },
    ],
    []
  ).length,
  1
);

check('nothing read means nothing claimed', confirmReferences([], []), []);

group('the card is written to be read out at a desk');

const doc = {
  kind: 'imaging report',
  title: 'Cervical spine MRI',
  dated: '2026-09-12',
  about: 'Neck pain and tingling in the left hand',
  clinician: {
    name: 'Mr A Okafor',
    role: 'Consultant Neurosurgeon',
    department: 'Neurosurgery',
    organisation: 'St Bartholomew’s Hospital',
  },
  contact: {
    phone: '020 7946 0321',
    email: null,
    secretary: 'Jane Hollis, ext 4412',
    address: 'West Smithfield, London EC1A 7BE',
  },
  references: [
    { label: 'NHS number', value: '485 777 3456', confirmed: true },
    { label: 'Hospital number', value: 'RX447102', confirmed: false },
  ],
  says: ['Disc bulge at C5/C6 with mild foraminal narrowing.', 'No cord compression.'],
  plainWords:
    'One of the cushions between the bones in the neck is pressing outward, slightly narrowing a gap a nerve passes through. Nothing is pressing on the spinal cord itself.',
  plan: ['Physiotherapy referral made.'],
  review: 'In 3 months, or sooner if symptoms change',
  routeBackIn: 'Contact my secretary directly if the tingling spreads or weakness develops.',
  medications: [],
  unreadable: ['The scan date in the header is blurred.'],
};

const body = cardBody(doc);

truthy('the numbers are in it', body.includes('485 777 3456'));
truthy('and so is the one to check, marked', body.includes('RX447102') && body.includes('check this against the letter'));
truthy('a confirmed number carries no warning', !body.split('485 777 3456')[1].startsWith('  (check'));
truthy('the phone number survives', body.includes('020 7946 0321'));
truthy('so does the secretary', body.includes('Jane Hollis'));
truthy('and the consultant and hospital', body.includes('Mr A Okafor') && body.includes('St Bartholomew'));

// HER ACTUAL QUESTION: "these symptoms are back, how do I get seen?"
truthy('the route back in is there, under its own heading', body.includes('If it comes back:'));
truthy('and says what the letter said', body.includes('Contact my secretary directly'));
truthy('the review date is kept', body.includes('In 3 months'));

truthy("what the letter SAYS is labelled as the letter's", body.includes('What the letter says:'));
truthy('and the explanation is labelled an explanation', body.includes('an explanation of the terms above, not a new opinion'));
truthy('the plain words are present', body.includes('cushions between the bones'));
truthy('what could not be read is admitted', body.includes('Could not be read from the photo:'));
truthy('and the card says the document is gone', body.includes('The document itself is not kept'));

group('the order is the order of the phone call');

const at = (needle) => body.indexOf(needle);
truthy('who, before what to quote', at('Seen by:') < at('To quote:'));
truthy('what to quote, before the findings', at('To quote:') < at('What the letter says:'));
truthy('the findings, before the explanation of them', at('What the letter says:') < at('In ordinary words'));
truthy('and the route back in comes last', at('If it comes back:') > at('What was agreed:'));

group('where it lands, and what she is told');

check('a report is medical history', cardSection(doc), 'Medical history');
check('a prescription is medication', cardSection({ ...doc, kind: 'prescription' }), 'Medication');
check('a referral is appointments', cardSection({ ...doc, kind: 'referral' }), 'Appointments');

const offer = offerLine(doc);
truthy('the offer names what it read', offer.includes('an imaging report'));
truthy('and says one number needs checking', offer.includes('1 of the 2 reference numbers'));
truthy('and admits what it could not make out', offer.includes('could not make out'));
truthy('and asks rather than saves', offer.includes('Want me to keep this'));

const clean = offerLine({ ...doc, references: [{ label: 'NHS number', value: '1', confirmed: true }], unreadable: [] });
truthy('a clean read says so plainly', clean.includes('read the reference numbers twice'));
truthy('and claims nothing about unreadable parts', !clean.includes('could not make out'));

const allBad = offerLine({
  ...doc,
  references: [
    { label: 'a', value: '1', confirmed: false },
    { label: 'b', value: '2', confirmed: false },
  ],
  unreadable: [],
});
truthy('and when none agreed, it says to check them all', allBad.includes('check them against the letter'));

group('a thin document does not pretend');

const thin = {
  ...doc,
  references: [],
  contact: { phone: null, email: null, secretary: null, address: null },
  plainWords: null,
  plan: [],
  review: null,
  routeBackIn: null,
  medications: [],
  unreadable: [],
};
const thinBody = cardBody(thin);
truthy('no empty "To quote" heading', !thinBody.includes('To quote:'));
truthy('no empty contact block', !thinBody.includes('Contact:'));
truthy('no empty explanation heading', !thinBody.includes('In ordinary words'));
truthy('no invented route back in', !thinBody.includes('If it comes back:'));
truthy('but what it did say is still there', thinBody.includes('Disc bulge at C5/C6'));

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
