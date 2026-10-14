// WHAT SHE EXPORTS IS WHAT THE TAB HOLDS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-export-is-the-whole-tab.mjs
//
// FOUND 14 OCTOBER 2026, while building the standing details section.
//
// The Me tab's own words for the button are "Export to print or share", and the
// code's own words are "the whole tab as it stands". It read `kind = 'me'`. A
// care record is written with kind 'care' - the Me tab draws both, and
// mobile/src/lib/insights.ts carries a note about this exact mistake being made
// in the other direction on 7 October, when a care record was nearly filed into
// Insights. So the export has been silently leaving out every referral, every
// consultant's details and every reference number, while presenting itself as
// the tab.
//
// The worst version: taking the printed page to an appointment and finding the
// part you came for absent. Nothing on screen would have warned her, because
// from the tab's side nothing was wrong.
//
// SO THIS CHECKS THE SHAPE, not the string: every kind the Me tab draws must be
// a kind the export reads. The two lists are compared rather than read.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { renderMeExport } = await import(root + '/app/lib/me-export.ts');
const { cardBody } = await import(root + '/app/lib/clinical-card.ts');

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');
const route = read('app/api/me-export/route.ts');
const insights = read('mobile/src/lib/insights.ts');
const save = read('app/lib/pending-save.ts');

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

/** A letter shaped like her knee referral, with nothing of hers in it. */
const LETTER = {
  kind: 'referral',
  title: 'GP referral to Physiotherapy',
  dated: '2026-10-12',
  bottomLine: 'Nothing here needs doing before the appointment.',
  watchFor: ['Give 24 hours notice to cancel, or the full fee may apply.'],
  costs: ['First consultation: up to £300'],
  about: 'Referral to the physiotherapy team for knee symptoms',
  clinician: { name: 'Dr A Example', role: 'GP', department: null, organisation: 'Example Practice' },
  references: [{ label: 'NHS number', value: '000 000 0000', confirmed: true }],
  contact: { phone: '0200 000 0000', secretary: null, email: null, address: '1 Example Road' },
  says: ['Pain at the back of the knee after running.'],
  plainWords: 'The GP is asking for an assessment.',
  medications: [],
  plan: ['Physiotherapy assessment requested.'],
  review: null,
  routeBackIn: null,
  unreadable: [],
};

console.log('\n  WHAT SHE EXPORTS IS WHAT THE TAB HOLDS\n');

check('every kind the Me tab draws is a kind the export reads', () => {
  // The app's list, from the one place that decides which tab a row lands on.
  const drawn = insights.match(/const ME_KINDS[^=]*= \[([^\]]+)\]/);
  assert.ok(drawn, 'ME_KINDS has moved, so nothing says which kinds the tab draws');
  const tabKinds = [...drawn[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  // The export's list.
  const read_ = route.match(/\.in\('kind', \[([^\]]+)\]\)/);
  assert.ok(read_, 'the export reads a single kind again, so something is missing from the page');
  const exportKinds = [...read_[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  const missing = tabKinds.filter((k) => !exportKinds.includes(k));
  assert.deepStrictEqual(
    missing,
    [],
    `the tab draws ${tabKinds.join(', ')} and the export reads ${exportKinds.join(', ')} - missing: ${missing.join(', ')}`
  );
  // And the server's own list of card kinds agrees with both.
  const card = save.match(/export const CARD_TYPES: SaveType\[\] = \[([^\]]+)\]/);
  assert.ok(card, 'CARD_TYPES has moved');
  return `${exportKinds.join(', ')}`;
});

check('an archived card is not exported', () => {
  // A paused card stays, with its reason - that is the brief. An ARCHIVED one
  // was taken off the tab on purpose, and handing it to a clinician on a page
  // headed "how I operate" would be stating something she had retired.
  assert.ok(/\.eq\('status', 'active'\)/.test(route), 'the export includes rows the tab has dropped');
  return 'active only';
});

check('a care record reaches the page with no stars on it', () => {
  const body = cardBody(LETTER);
  assert.ok(/\*\*/.test(body), 'the fixture has no marks, so this proves nothing');
  const html = renderMeExport(
    [{ title: LETTER.title, category: 'How I Access Care', content: { why: LETTER.about, detail: body }, created_at: '2026-10-12T09:00:00Z' }],
    { name: 'Example', today: '2026-10-14T09:00:00Z' }
  );
  assert.ok(!/\*\*/.test(html), 'the page prints the stars it was given');
  // The headings became headings rather than vanishing.
  assert.ok(/<h4>What was agreed<\/h4>/.test(html), 'a heading did not survive as a heading');
  assert.ok(/<h4>To quote<\/h4>/.test(html), 'the references lost their heading');
  // And the numbers are on the page.
  assert.ok(/000 000 0000/.test(html), 'the reference number is not on the page');
  assert.ok(/<em>/.test(html), 'the quiet note about the document was not rendered');
  return 'headings, bullets and numbers';
});

check('her standing details lead the page', () => {
  const html = renderMeExport([], {
    name: 'Example',
    today: '2026-10-14T09:00:00Z',
    details: [
      { label: 'NHS number', value: '000 000 0000', note: null, confirmed: true },
      { label: 'Membership number', value: 'EX-1', note: 'quote when booking', confirmed: false },
    ],
  });
  assert.ok(/Details I am asked for/.test(html), 'the page has no standing details section');
  assert.ok(/000 000 0000/.test(html), 'a detail is missing from the page');
  assert.ok(/quote when booking/.test(html), 'a note on a detail is dropped');
  assert.ok(/worth checking against the letter/.test(html), 'an unchecked detail is presented as checked');
  // And a page that holds ONLY details does not also say nothing is there.
  assert.ok(!/Nothing has been added yet/.test(html), 'a page full of details says it is empty');
  return 'two details, one marked';
});

check('a page with nothing at all still says so', () => {
  const html = renderMeExport([], { name: null, today: '2026-10-14T09:00:00Z' });
  assert.ok(/Nothing has been added yet/.test(html), 'an empty export says nothing at all');
  return 'the empty case kept';
});

check('and this check can fail', () => {
  // THE OLD QUERY: one kind, and no status filter.
  const old = ".eq('kind', 'me')";
  assert.ok(!/\.in\('kind'/.test(old), 'the old single-kind read matches the new pattern');
  // THE OLD RENDER: the detail escaped into a paragraph, stars and all.
  const body = cardBody(LETTER);
  const oldHtml = `<p class="detail">${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`;
  assert.ok(/\*\*/.test(oldHtml), 'the old render reads as clean, so the marks test cannot fail');
  return 'both old shapes fail';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
