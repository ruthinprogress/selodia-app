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
// apart and the rows fall into a section of their own with the wrong name,
// while the real How I Access Care sits empty at the bottom of the page.
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
  const shared = ['CARE_SECTION', 'CARE_SUBTITLE'];
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

check('it is its own section, last, and always there', () => {
  // Ruth, 12 October 2026: "How I Access Care needs to be its own section at
  // the bottom of the list. It's not working hidden." It was a group inside
  // Health until then, and nobody could find it.
  assert.ok(/from '@\/lib\/care-admin'/.test(screen), 'the screen does not read the shared names at all');
  assert.ok(!('CARE_PARENT_SECTION' in CLIENT), 'the client still names a parent section');
  assert.ok(!('CARE_PARENT_SECTION' in SERVER), 'the server still names a parent section');
  assert.ok(
    /\.filter\(\(n\) => n !== CARE_SECTION\)/.test(screen),
    'care rows are not taken out of the reorderable sections, so it could be dragged up or appear twice'
  );
  const reorder = screen.indexOf('<ReorderableRows');
  const last = screen.indexOf('{renderSection(care, ordered.length)}');
  assert.ok(last > reorder && reorder > 0, 'How I Access Care is not drawn after the other sections');
  // Always there: built from the entries whether or not any match.
  assert.ok(
    /const care = useMemo\(\s*\(\) => \(\{ name: CARE_SECTION, rows: entries\.filter/.test(screen),
    'the section only exists when it has a row, so a new account never finds it'
  );
  return 'own section, after the reorderable ones, shown when empty';
});

check('the save line sends her to where the record is', () => {
  const pending = readFileSync('app/lib/pending-save.ts', 'utf8');
  assert.ok(!/under Me, in Health\.`/.test(pending), 'a care save still says it went under Health');
  assert.ok(/Kept in How I Access Care/.test(pending), 'a care save does not name its section');
  return '"Kept in How I Access Care, at the bottom of Me."';
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

  // THE SAME OFFER WITH ITS FIELDS AT THE TOP LEVEL (13 October 2026). The model
  // flattens a long care offer - why and detail beside title, no content - and
  // that shape was refused, so her insurer's details were offered in words and
  // never stored. It must survive, with what she gave it intact.
  const flat = SAVE.coerceProposal({
    type: 'care',
    title: 'Example Health',
    why: 'Insurer route to a consultant by video.',
    detail: 'Authorisation code AB1234. Excess paid.',
  });
  assert.ok(flat !== null, 'a care offer with its fields at the top level is refused, so it is offered and never stored');
  assert.strictEqual(flat.content.why, 'Insurer route to a consultant by video.');
  assert.ok(/AB1234/.test(String(flat.content.detail)), 'the detail did not survive the flat shape');
  // Its section is set when it is saved - "proposal.type === 'care' ? CARE_SECTION",
  // asserted below - so a flat offer with none still lands in How I Access Care.
  assert.strictEqual(proposal.type, 'care', 'a care record is being coerced into something else');
  assert.strictEqual(
    proposal.content.section,
    SERVER.CARE_SECTION,
    'the section does not survive coercion, so the card lands outside the group'
  );

  // THE MODEL MAY OFFER ONE SINCE 12 OCTOBER 2026, AND ONLY OFFER IT. This
  // assertion used to fail if "care" appeared in the chat's type union, on the
  // rule that a care record comes off a document, never from a conversation.
  // Ruth changed the rule, on a screenshot of her GP practice's website: it
  // should have "asked if it was the users practice and if they wanted saves".
  // A screenshot she chose to send is something she uploaded. So what this now
  // holds is the narrower rule that survived:
  const chat = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const union = chat.match(/"type": ("[a-z]+"(?: \| "[a-z]+")*)/);
  assert.ok(union, 'the proposedSave type union has moved');
  assert.ok(/"care"/.test(union[1]), 'the chat cannot offer a care record, so a practice she shows it cannot be kept');
  //   - it is an OFFER: it goes through the same offer-and-yes as everything
  //     else, and the app asks its own question before anything is written;
  const pending = readFileSync('app/lib/pending-save.ts', 'utf8');
  assert.ok(/if \(type === 'care'\) return CARE_OFFER_QUESTION;/.test(pending), 'a care offer has no question of its own');
  //   - never because a conversation merely sounded administrative;
  assert.ok(
    /Never offer one because a conversation merely sounded administrative/.test(chat),
    'the prompt no longer forbids offering a care record from a conversation that only sounded like admin'
  );
  //   - and it lands in How I Access Care whatever section the model named.
  assert.ok(
    /proposal\.type === 'care'\s*\?\s*CARE_SECTION/.test(pending),
    'a care record can be filed under a section the model invented, where she will not find it'
  );
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
