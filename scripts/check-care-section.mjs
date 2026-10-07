// HER RECORDS HAVE A PLACE SHE CAN OPEN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-care-section.mjs
//
// THE SERVER DECIDES WHAT SECTION A CARE CARD IS FILED UNDER. THE CLIENT DECIDES
// WHAT SHE READS AT THE TOP OF IT. Those are two copies of one string in two
// files that share no tsconfig, which is the fault this repository has had six
// times in a fortnight and never once noticed at the moment it happened.
//
// WHAT DRIFT WOULD DO HERE, and it is worse than a wrong label. The card is
// written with `category = cardSection(doc)`. The screen groups by category and
// pulls out the rows whose category equals ITS copy of the name. One character
// apart and the rows fall through to a top-level section of their own - which
// is the one shape she ruled out, because she asked for this to sit inside
// Health so the app does not say her life is about health issues.
//
// So both ways, every string, and a failing fixture to prove the comparison is
// real rather than two reads of the same constant.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const SERVER = await import(root + '/app/lib/care-admin.ts');
const CLIENT = await import(root + '/mobile/src/lib/care-admin.ts');
const SAVE = await import(root + '/app/lib/pending-save.ts');

const screen = readFileSync('mobile/src/components/me-protocol.tsx', 'utf8');
const card = readFileSync('app/lib/clinical-card.ts', 'utf8');

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

console.log('\n  HOW I ACCESS CARE\n');

check('the two copies agree, both ways', () => {
  // BOTH WAYS. A one-way check passes when the client gains a string the server
  // has never heard of, which is how the client ends up rendering a heading
  // over a group nothing will ever be filed into.
  const shared = ['CARE_SECTION', 'CARE_SUBTITLE', 'CARE_PARENT_SECTION'];
  for (const key of shared) {
    assert.ok(key in SERVER, `the server has lost ${key}`);
    assert.ok(key in CLIENT, `the client has lost ${key}`);
    assert.strictEqual(CLIENT[key], SERVER[key], `${key} has drifted between the two copies`);
  }
  return shared.map((k) => `${k}="${SERVER[k]}"`).join(', ');
});

check('they are her words and not a tidied version of them', () => {
  // HER MESSAGE, 6 October 2026: "How I Access Care. Letters, numbers,
  // references, emails". Pinned because a heading is the one thing in this
  // feature nobody will notice me improving.
  assert.strictEqual(SERVER.CARE_SECTION, 'How I Access Care');
  assert.strictEqual(SERVER.CARE_SUBTITLE, 'Letters, numbers, references, emails');
  // "Care Admin" was her first try and she replaced it herself a minute later.
  assert.ok(!/Care Admin/i.test(SERVER.CARE_SECTION), 'the heading went back to Care Admin');
  return 'verbatim';
});

check('a care card is filed under it, and a prescription is not', () => {
  assert.ok(/CARE_SECTION/.test(card), 'the section is hard-coded in clinical-card rather than read');
  assert.ok(
    !/'Medical history'/.test(card),
    'a care record is still filed under Medical history, which is the thing she ruled out'
  );
  return 'one name, read from one place';
});

check('the screen renders it inside Health, not beside it', () => {
  assert.ok(/from '@\/lib\/care-admin'/.test(screen), 'the screen does not read the shared names at all');
  assert.ok(
    /name === CARE_SECTION/.test(screen),
    'care rows are not pulled out of the top-level sections, so they would appear as their own'
  );
  assert.ok(
    /care: name === CARE_PARENT_SECTION \? care : \[\]/.test(screen),
    'care rows are not attached to the parent section'
  );
  assert.strictEqual(CLIENT.CARE_PARENT_SECTION, 'Health', 'the parent section is no longer Health');
  return 'grouped under Health';
});

check('the section appears as soon as a care row does', () => {
  // A ROW FILED SOMEWHERE SHE CANNOT OPEN IS A LOST ROW. She has a Health
  // section today, but somebody who shares a letter before ever saving a Health
  // card has none, and the card would be written to a section that renders
  // nowhere.
  assert.ok(
    /if \(!map\.has\(CARE_PARENT_SECTION\)\) map\.set\(CARE_PARENT_SECTION, \[\]\)/.test(screen),
    'a care row does not create its parent section, so it would be filed out of sight'
  );
  return 'Health is created by a care row when it does not exist';
});

check('a parsed letter actually survives being turned into a card', () => {
  // THE WHOLE FEATURE WAS DEAD HERE AND THE SCREEN WOULD HAVE HIDDEN IT.
  //
  // 7 October 2026. Everything existed: the parser, the card body, the section
  // name she chose, and `type: 'care'` handed to coerceProposal. SAVE_TYPES did
  // not contain 'care', so coerceSaveType returned null, coerceProposal returned
  // null, and parse-document returned its own 500: "I read the document, but
  // could not make a record of it that would keep."
  //
  // Nobody saw it because sharing a letter is rare, and the database agrees:
  // zero care rows have ever existed. Had this not been checked, the group below
  // would have rendered its empty line forever and read as a design decision.
  //
  // THE SHAPE IS THE ONE THE ROUTE REALLY SENDS, read from the route, so a
  // change to what it passes fails here rather than in front of her.
  const parse = readFileSync('app/api/parse-document/route.ts', 'utf8');
  assert.ok(/type: 'care'/.test(parse), 'the document route no longer proposes a care record');
  assert.ok(
    /content: \{ section: cardSection\(doc\)/.test(parse),
    'the card is no longer filed by cardSection, so the screen could not find it'
  );

  const proposal = SAVE.coerceProposal({
    type: 'care',
    title: 'Rheumatology, Mr Adeyemi',
    content: { section: SERVER.CARE_SECTION, why: 'Letter dated 2 October.', detail: '**Seen by**' },
  });
  assert.ok(proposal !== null, 'a care record is still refused by coerceProposal, so no letter can be kept');
  assert.strictEqual(proposal.type, 'care', 'a care record is being coerced into something else');
  assert.strictEqual(
    proposal.content.section,
    SERVER.CARE_SECTION,
    'the section does not survive coercion, so the card lands outside the group'
  );

  // AND IT IS STILL NOT SOMETHING THE MODEL CAN INVENT. A care record comes off
  // a document, never from a conversation sounding administrative.
  const chat = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const union = chat.match(/"type": ("[a-z]+"(?: \| "[a-z]+")*)/);
  assert.ok(union, 'the proposedSave type union has moved');
  assert.ok(!/"care"/.test(union[1]), 'the model can now offer a care record out of thin air');
  return 'kept, filed, and still not model-offerable';
});

check('the empty group says what to do, not what the database holds', () => {
  assert.ok(/CARE_EMPTY/.test(screen), 'an empty group renders nothing at all');
  assert.ok(
    !/^No records yet/i.test(CLIENT.CARE_EMPTY),
    'the empty line describes the app to her rather than what she could do'
  );
  assert.ok(/chat/i.test(CLIENT.CARE_EMPTY), 'it does not say where a record comes from');
  return `"${CLIENT.CARE_EMPTY.slice(0, 44)}..."`;
});

check('and this check can fail', () => {
  // THE COMPARISON IS REAL. If both sides were read from one constant this
  // fixture could not differ from either, and the check above would be two
  // reads of the same value wearing a comparison.
  const drifted = { ...CLIENT, CARE_SECTION: 'How I access care' };
  assert.notStrictEqual(
    drifted.CARE_SECTION,
    SERVER.CARE_SECTION,
    'a one-character case change is not detected, so nothing here compares anything'
  );
  return 'a single changed character is caught';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
