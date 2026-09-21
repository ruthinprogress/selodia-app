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

import { confirmReferences, sameValue, stated, tidy } from '../app/lib/clinical-document.ts';
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

// THE SECOND READING IS A CHECK, NOT A SOURCE (changed 21 September). It used
// to contribute anything the extraction had missed, which on her real MRI
// report meant a second "Name" row beside "Patient name" - two lines for one
// fact, the newcomer wearing a warning. That is the noise that made her say the
// feature would not be trusted.
const onlySecond = confirmReferences(
  [{ label: 'NHS number', value: '4857773456' }],
  [
    { label: 'NHS number', value: '4857773456' },
    { label: 'Appointment ref', value: 'APP-99213' },
  ]
);
check('the second reading adds nothing of its own', onlySecond, [
  { label: 'NHS number', value: '4857773456', confirmed: true },
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

group('a number is confirmed for a field, not in the abstract');

// THE WORST DEFECT THIS FILE HAS HAD, found in review. The guard used to ask
// "did this string appear anywhere in the second reading?", which is not the
// question. An NHS number and a hospital number sit side by side on an NHS
// letter and look alike. A second reading that SWAPPED them contains both
// strings - so both came back confirmed, printed under the wrong headings,
// and the offer line told her the two readings agreed. Two readings
// disagreeing about what a number IS, reported as agreement.
const swapped = confirmReferences(
  [
    { label: 'NHS number', value: '943 476 5919' },
    { label: 'Hospital number', value: '485 002 1176' },
  ],
  [
    { label: 'Hospital number', value: '9434765919' },
    { label: 'NHS number', value: '4850021176' },
  ]
);
check('a swap is not agreement', swapped.map((r) => r.confirmed), [false, false]);
truthy('and both are still offered, to be checked', swapped.length === 2);

check(
  'the right number under the right label is still confirmed',
  confirmReferences(
    [
      { label: 'NHS number', value: '943 476 5919' },
      { label: 'Hospital number', value: '485 002 1176' },
    ],
    [
      { label: 'NHS Number', value: '9434765919' },
      { label: 'hospital  number', value: '485-002-1176' },
    ]
  ).map((r) => r.confirmed),
  [true, true]
);

group('one line per field, whichever reading found it');

// The ordinary phone-photo failure: the same number read off the letterhead
// and again off the footer, a digit apart. Both used to reach the card.
check(
  'the same field read twice is one line',
  confirmReferences(
    [
      { label: 'Hospital number', value: 'RX1-448210' },
      { label: 'Hospital number', value: 'RX1-448270' },
    ],
    [{ label: 'Hospital number', value: 'RX1-448210' }]
  ),
  [{ label: 'Hospital number', value: 'RX1-448210', confirmed: true }]
);

check(
  'and the second reading cannot add a rival for a field already answered',
  confirmReferences(
    [{ label: 'Hospital number', value: 'RX1-448210' }],
    [{ label: 'hospital number', value: 'RX1-448270' }]
  ),
  [{ label: 'Hospital number', value: 'RX1-448210', confirmed: false }]
);

const many = confirmReferences(
  Array.from({ length: 45 }, (_, i) => ({ label: `Ref ${i}`, value: `V${i}` })),
  []
);
check('a ceiling well above any real letter', many.length, 40);
truthy('and it keeps the earliest, which is the top of the page', many[0].label === 'Ref 0');

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
truthy('and so is the one to check, marked', body.includes('RX447102') && body.includes('check this one against the letter'));
truthy('a confirmed number carries no warning', !body.split('485 777 3456')[1].startsWith('  (check'));
truthy('the phone number survives', body.includes('020 7946 0321'));
truthy('so does the secretary', body.includes('Jane Hollis'));
truthy('and the consultant and hospital', body.includes('Mr A Okafor') && body.includes('St Bartholomew'));

// HER ACTUAL QUESTION: "these symptoms are back, how do I get seen?"
truthy('the route back in is there, under its own heading', body.includes('**If it comes back**'));
truthy('and says what the letter said', body.includes('Contact my secretary directly'));
truthy('the review date is kept', body.includes('In 3 months'));

truthy("what the letter SAYS is labelled as the letter's", body.includes('**What the letter says**'));
truthy('and the explanation is labelled an explanation', body.includes('An explanation of the terms above, not a new opinion'));
truthy('the plain words are present', body.includes('cushions between the bones'));
truthy('what could not be read is admitted', body.includes('**Could not be read**'));
truthy('and the card says the document is gone', body.includes('The document itself is not kept'));

group('the order is the order of the phone call');

const at = (needle) => body.indexOf(needle);
truthy('who, before what to quote', at('**Seen by**') < at('**To quote**'));
truthy('what to quote, before the findings', at('**To quote**') < at('**What the letter says**'));
truthy('the findings, before the explanation of them', at('**What the letter says**') < at('**In ordinary words**'));
truthy('and the route back in comes last', at('**If it comes back**') > at('**What was agreed**'));

group('where it lands, and what she is told');

check('a report is medical history', cardSection(doc), 'Medical history');
check('a prescription is medication', cardSection({ ...doc, kind: 'prescription' }), 'Medication');
check('a referral is appointments', cardSection({ ...doc, kind: 'referral' }), 'Appointments');

const offer = offerLine(doc);
truthy('the offer names what it read', offer.includes('an imaging report'));
truthy('and says which one needs checking, by name', offer.includes('a different answer for Hospital number'));
truthy('and admits what it could not make out', offer.includes('could not make out'));
truthy('and asks rather than saves', offer.includes('Want me to keep this'));

const clean = offerLine({ ...doc, references: [{ label: 'NHS number', value: '1', confirmed: true }], unreadable: [] });
// A CLEAN READ SAYS NOTHING ABOUT READING TWICE. A process that worked is not
// news, and reporting it every time is what turned a safeguard into noise.
truthy('a clean read does not mention checking at all', !clean.includes('marked to check'));
truthy('and claims nothing about unreadable parts', !clean.includes('could not make out'));

const allBad = offerLine({
  ...doc,
  references: [
    { label: 'a', value: '1', confirmed: false },
    { label: 'b', value: '2', confirmed: false },
  ],
  unreadable: [],
});
truthy('and when two disagree it names both', allBad.includes('a and b'));

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
truthy('no empty "To quote" heading', !thinBody.includes('**To quote**'));
truthy('no empty contact block', !thinBody.includes('**Contact**'));
truthy('no empty explanation heading', !thinBody.includes('**In ordinary words**'));
truthy('no invented route back in', !thinBody.includes('**If it comes back**'));
truthy('but what it did say is still there', thinBody.includes('Disc bulge at C5/C6'));

group('a mark means the readings disagree, and nothing else');

// HER VERDICT ON THE FIRST VERSION, from her real MRI report: "lots of comments
// that it needs to be checked - this is terrible UI, it needs to just get it
// right ... or it's actually just useless and will not be trusted." It marked
// 10 of 14 details, including her own name and the hospital's phone number,
// because two prompts label things differently - not because anything
// disagreed. A warning on ten lines of fourteen teaches you to skip warnings.

check(
  'a field the second reading never mentioned is not a doubt',
  confirmReferences([{ label: 'Hospital Number', value: '676230' }], []),
  [{ label: 'Hospital Number', value: '676230', confirmed: true }]
);

check(
  'a field with no digits is never marked',
  confirmReferences(
    [{ label: 'Patient name', value: 'Ms Ruth CHRISTIANSON-MONROY' }],
    [{ label: 'Name', value: 'Ruth Christianson-Monroy' }]
  ),
  [{ label: 'Patient name', value: 'Ms Ruth CHRISTIANSON-MONROY', confirmed: true }]
);

check(
  'the same digits read twice are agreement whatever the punctuation',
  confirmReferences(
    [{ label: 'T', value: '020 7806 4000' }],
    [{ label: 't', value: '02078064000' }]
  )[0].confirmed,
  true
);

// THE ONE THING A MARK IS FOR.
check(
  'the same field with different digits IS a doubt',
  confirmReferences(
    [{ label: 'Hospital Number', value: '676230' }],
    [{ label: 'hospital number', value: '676238' }]
  ),
  [{ label: 'Hospital Number', value: '676230', confirmed: false }]
);

check(
  'and a swap is still caught, because each field contradicts its own rival',
  confirmReferences(
    [
      { label: 'NHS number', value: '943 476 5919' },
      { label: 'Hospital number', value: '485 002 1176' },
    ],
    [
      { label: 'Hospital number', value: '9434765919' },
      { label: 'NHS number', value: '4850021176' },
    ]
  ).map((r) => r.confirmed),
  [false, false]
);

// A REAL LETTER'S WORTH, to prove the noise is gone.
const real = confirmReferences(
  [
    { label: 'Hospital Number', value: '676230' },
    { label: 'DoB', value: '11-Sep-1985' },
    { label: 'Date/Time of Exam', value: '03-Jul-2026 13:23' },
    { label: 'GMC number', value: 'GMC6076495' },
    { label: 'Patient name', value: 'Ms Ruth CHRISTIANSON-MONROY' },
    { label: 'Sex', value: 'Female' },
    { label: 'T', value: '020 7806 4000' },
    { label: 'E', value: 'info@hje.org.uk' },
  ],
  [
    { label: 'Hospital No', value: '676230' },
    { label: 'Date of birth', value: '11 Sep 1985' },
  ]
);
check('none of the eight is marked, because none was contradicted', real.filter((r) => !r.confirmed).length, 0);

group('an escape is not a line break, and an absence is not a value');

// Her MRI report came back with a literal backslash-n between every paragraph
// of the explanation, printed as characters in the middle of the text.
const LITERAL = 'First para.' + String.fromCharCode(92) + 'n' + String.fromCharCode(92) + 'n' + 'Second para.';
check(
  'a written-out escape becomes a real break',
  tidy(LITERAL),
  'First para.' + String.fromCharCode(10, 10) + 'Second para.'
);
check('a real break is left alone', tidy('A' + String.fromCharCode(10, 10) + 'B'), 'A' + String.fromCharCode(10, 10) + 'B');
check('nothing is nothing', tidy(null), null);

check('"Not stated in this document" is an absence', stated('Not stated in this document.'), null);
check('so is "None"', stated('None'), null);
check('so is "n/a"', stated('n/a'), null);
check('a real review date survives', stated('In 3 months, or sooner if symptoms change'), 'In 3 months, or sooner if symptoms change');
check('and so does a sentence that merely starts with no', stated('Nothing further is planned at this stage'), 'Nothing further is planned at this stage');

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
