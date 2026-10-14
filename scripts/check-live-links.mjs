// AN ADDRESS THE APP ALREADY HAS IS NOT SOMETHING SHE SHOULD HAVE TO TYPE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-live-links.mjs
//
// Ruth, 14 October 2026: "also anything that can be a live link to reduce
// friction, should be, eg, your doctor surgery to message for referrals or apts
// at Klinik."
//
// THE WHOLE RISK IS IN THE OTHER DIRECTION, so that is most of what this
// checks. Linking too little costs a few seconds of typing. Linking too much
// turns an NHS number, a date, a set of reps or a claim reference into
// something that offers to dial it - and a record full of fake phone numbers is
// a record she stops believing. Nothing in the digits separates "485 777 3456"
// from "020 7946 0958", so a number is only a number to ring when the words
// immediately before it say so, which is exactly how cardBody writes them.
//
// The same rule, from the same reasoning, is in mobile/src/lib/care-constants.ts
// for the standing details rows. Both are checked here so they cannot drift to
// two different answers about the same digits.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { runs } = await import(root + '/mobile/src/lib/rich-text.ts');
const { tapActionFor } = await import(root + '/mobile/src/lib/care-constants.ts');
const { cardBody } = await import(root + '/app/lib/clinical-card.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const formatted = read('mobile/src/components/formatted-text.tsx');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

/** Every link in a stretch of text, as "text -> url". */
const links = (text) =>
  runs(text)
    .filter((r) => r.link)
    .map((r) => `${r.text} -> ${r.link}`);

console.log('\n  AN ADDRESS SHE SHOULD NOT HAVE TO TYPE\n');

check('a booking page, an address and a labelled number all open', () => {
  assert.deepStrictEqual(links('Book at https://example.nhs.uk/appointments or call.'), [
    'https://example.nhs.uk/appointments -> https://example.nhs.uk/appointments',
  ]);
  assert.deepStrictEqual(links('Go to www.example-practice.co.uk for referrals'), [
    'www.example-practice.co.uk -> https://www.example-practice.co.uk',
  ]);
  assert.deepStrictEqual(links('Email: secretary@example.org'), [
    'secretary@example.org -> mailto:secretary@example.org',
  ]);
  assert.deepStrictEqual(links('Phone: 0200 946 0958'), ['0200 946 0958 -> tel:02009460958']);
  assert.deepStrictEqual(links('Secretary: 020 7946 0958'), ['020 7946 0958 -> tel:02079460958']);
  return 'four kinds';
});

check('a number that is not a phone number is never offered as one', () => {
  const leaveAlone = [
    'NHS number: 485 777 3456',
    'Hospital number: 0123456789',
    'Three sets of 8 to 10 reps, 90 seconds rest.',
    'Letter dated 12 October 2026',
    'Ref 2026-10-12-0043 quoted on the letter',
    'Membership EX-4471902, excess paid 250',
    'Authorisation 4471902 0938 2201',
  ];
  for (const line of leaveAlone) {
    assert.deepStrictEqual(links(line), [], `"${line}" became tappable`);
  }
  return `${leaveAlone.length} lines left as text`;
});

check('a record and a standing detail agree about the same digits', () => {
  // The one failure that would be visible and confusing: the same number
  // dialling from one screen and copying from another.
  const pairs = [
    ['NHS number', '485 777 3456', false],
    ['Surgery phone', '020 7946 0958', true],
  ];
  for (const [label, value, shouldOpen] of pairs) {
    const onTheRow = tapActionFor(value, label).kind === 'open';
    const inTheRecord = links(`${label}: ${value}`).length > 0;
    assert.strictEqual(onTheRow, shouldOpen, `the standing details row got "${label}" wrong`);
    assert.strictEqual(inTheRecord, shouldOpen, `the record got "${label}" wrong`);
  }
  return 'one answer per number';
});

check('emphasis survives a link, and a link survives emphasis', () => {
  const r = runs('**Book here: https://example.org/x** today');
  const linked = r.filter((x) => x.link);
  assert.strictEqual(linked.length, 1, 'a link inside a heading was lost');
  assert.ok(linked[0].bold, 'a link inside a bold stretch lost its weight');
  // And the words either side of it are still there, in order.
  assert.strictEqual(r.map((x) => x.text).join(''), 'Book here: https://example.org/x today');
  return 'bold and tappable';
});

check('a real care record comes out tappable where it should', () => {
  const body = cardBody({
    kind: 'referral',
    title: 'GP referral to Physiotherapy',
    dated: '2026-10-12',
    bottomLine: 'Nothing here needs doing before the appointment.',
  watchFor: ['Give 24 hours notice to cancel, or the full fee may apply.'],
  costs: ['First consultation: up to £300'],
  about: 'Knee symptoms',
    clinician: { name: 'Dr A Example', role: 'GP', department: null, organisation: 'Example Practice' },
    references: [{ label: 'NHS number', value: '485 777 3456', confirmed: true }],
    contact: {
      phone: '020 7946 0958',
      secretary: null,
      email: 'physio@example.nhs.uk',
      address: '1 Example Road',
    },
    says: ['Pain at the back of the knee.'],
    plainWords: 'An assessment is being asked for.',
    medications: [],
    plan: ['Book through https://example.nhs.uk/appointments'],
    review: null,
    routeBackIn: null,
    unreadable: [],
  });
  const found = body.split('\n').flatMap((line) => links(line));
  const urls = found.map((f) => f.split(' -> ')[1]);
  assert.ok(urls.includes('https://example.nhs.uk/appointments'), 'the booking page is not tappable');
  assert.ok(urls.includes('mailto:physio@example.nhs.uk'), 'the department address is not tappable');
  assert.ok(urls.includes('tel:02079460958'), 'the number under Phone is not tappable');
  assert.ok(
    !urls.some((u) => u.includes('4857773456')),
    `her NHS number is offered as a phone call: ${urls.join(', ')}`
  );
  return `${found.length} links, and the NHS number is not one`;
});

check('the component actually opens them', () => {
  assert.ok(/onPress=\{r\.link \?/.test(formatted), 'a link is drawn as a link and does nothing when tapped');
  assert.ok(/openBrowserAsync\(url\)/.test(formatted), 'a web address does not open in the app browser');
  assert.ok(/Linking\.openURL\(url\)/.test(formatted), 'tel: and mailto: are handed to the browser, which cannot take them');
  // UNDERLINED AS WELL AS COLOURED: the accent alone is not enough for anybody
  // who cannot separate the two colours, and this may be a number to ring.
  assert.ok(/link: \{ textDecorationLine: 'underline' \}/.test(formatted), 'a link is told apart by colour alone');
  return 'opened, and visible as a link';
});

check('and this check can fail', () => {
  // THE OLD RULE: digits alone. It would have dialled her NHS number.
  const digitsOnly = /\+?\d[\d\s()-]{7,}\d/;
  assert.ok(digitsOnly.test('485 777 3456'), 'the old rule reads as safe, so these tests prove nothing');
  assert.ok(digitsOnly.test('Hospital number: 0123456789'), 'the old rule misses a hospital number too');
  // And before today, nothing in a record was tappable at all.
  assert.strictEqual(links('Book at https://example.org/x').length, 1, 'nothing is linked, so the first test is vacuous');
  return 'the digits-only rule catches her NHS number';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
