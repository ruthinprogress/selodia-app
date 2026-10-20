// THE ME TAB'S HEADINGS, AND THE TAB THE APP SAYS A CARD WENT TO.
//
//   node scripts/check-me-sections.mjs
//
// Ruth, 20 October 2026, two findings from one screenful:
//
//   "It says Almanac still, but actually it's Me tab."
//   "We have Health competing with How I Access Care, which is confusing...
//    Details I am asked for - rename to 'Details to Access Health Care'. HOW i
//    access Care - rename to 'Health Care Records'. merge 'Health' into Health
//    care records"
//
// RENAMED AT RENDER, NEVER IN THE DATABASE, which is the whole risk here. The
// section name is written into every row's content and matched against by the
// server, so renaming the stored string would mean rewriting rows she has
// already filed - and any that were missed would quietly vanish from the tab.
// goal-display.ts settled this pattern months ago: capitalise at render, never
// in the database. These are headings; the stored words are identities.

import assert from 'node:assert';
import fs from 'node:fs';

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

const protocol = fs.readFileSync('mobile/src/components/me-protocol.tsx', 'utf8');
const careLib = fs.readFileSync('mobile/src/lib/care-admin.ts', 'utf8');
// THE SERVER KEEPS ITS OWN COPY of the same constant, and the mobile file says
// so: "Must equal the server's." The first version of this check read only the
// phone's, so mutating the server's to prove the check could fail changed
// nothing and the check passed - which is how a guard that reads one of two
// copies looks from the outside. Both are read now.
const careServer = fs.readFileSync('app/lib/care-admin.ts', 'utf8');
const detailsLib = fs.readFileSync('mobile/src/lib/care-constants.ts', 'utf8');
const pending = fs.readFileSync('app/lib/pending-save.ts', 'utf8');
const structure = fs.readFileSync('app/lib/app-structure.ts', 'utf8');

console.log('\n  THE ME TAB SAYS WHERE THINGS ARE\n');

check('THE STORED SECTION NAMES ARE UNTOUCHED', () => {
  // THE THING THAT MUST NOT CHANGE. Rename these and every row already filed
  // under the old string stops being found - by the tab and by the server.
  for (const [where, source] of [
    ['the phone', careLib],
    ['the server', careServer],
  ]) {
    assert.ok(
      /export const CARE_SECTION = 'How I Access Care';/.test(source),
      `the stored care section was renamed on ${where} - rows already filed under it are now orphaned`
    );
  }
  // AND THE TWO COPIES MUST AGREE, which is the fault a single-file check
  // cannot see: one renamed and one not would file new records under a section
  // the other never looks in.
  const onPhone = careLib.match(/export const CARE_SECTION = '([^']+)';/)?.[1];
  const onServer = careServer.match(/export const CARE_SECTION = '([^']+)';/)?.[1];
  assert.strictEqual(onPhone, onServer, 'the phone and the server disagree about the stored section');
  assert.ok(
    /export const DETAILS_SECTION = 'Details I Am Asked For';/.test(detailsLib),
    'the stored details section was renamed - same problem'
  );
  return 'identities intact';
});

check('AND THE HEADINGS SHE READS ARE THE NEW ONES', () => {
  assert.ok(/CARE_SECTION_LABEL = 'Health Care Records'/.test(careLib), 'the care heading is old');
  assert.ok(
    /DETAILS_SECTION_LABEL = 'Details to Access Health Care'/.test(detailsLib),
    'the details heading is old'
  );
  // Rendered, not merely defined - a constant nothing draws is the fault this
  // whole project keeps relearning.
  assert.ok(/const heading =/.test(protocol), 'nothing maps a section name to its heading');
  assert.ok(/\{heading\}/.test(protocol), 'the heading is computed and never drawn');
  assert.ok(
    !/\{section\.name\}\s*\n\s*<\/ThemedText>/.test(protocol),
    'the raw stored name is still being drawn as the heading'
  );
  // And spoken, or a screen reader gets the old name.
  assert.ok(/accessibilityLabel=\{heading\}/.test(protocol), 'a screen reader hears the old name');
  return 'both renamed at render, drawn and spoken';
});

check('HEALTH IS MERGED IN, AND NOT SHOWN TWICE', () => {
  assert.ok(/MERGED_INTO_CARE = 'Health'/.test(careLib), 'nothing names the merged section');
  assert.ok(
    /n !== CARE_SECTION && n !== MERGED_INTO_CARE/.test(protocol),
    'Health still appears as its own top-level section as well'
  );
  const at = protocol.indexOf('const care = useMemo');
  const body = protocol.slice(at, at + 700);
  assert.ok(
    /sectionOf\(e\.category\) === MERGED_INTO_CARE/.test(body),
    'the Health cards are filtered out of the list and never shown anywhere'
  );
  // Care records first: the paperwork is what somebody opens this for at a desk
  // with a receptionist waiting.
  const careFirst = body.indexOf('=== CARE_SECTION');
  const healthNext = body.indexOf('=== MERGED_INTO_CARE');
  assert.ok(careFirst > -1 && healthNext > careFirst, 'the health cards come before the paperwork');
  return 'one heading, records first';
});

check('AND THE STATUS WORD SURVIVES THE MERGE', () => {
  // Ruth, the same morning: "lets keep the lovely 'active' 'paused' etc label
  // function on records". It is on MeCardRow, which every section renders, so
  // the merge cannot lose it - but nothing said so, and a later edit could.
  // THE PROPERTY, NOT THE SPELLING. This read `card.status &&`, and broke on
  // 20 October when every record gained a default status and Closed was added
  // above it - a check defending an expression rather than the behaviour.
  // See DECISION_PATTERNS, 18 October.
  assert.ok(
    /const status = card\.status \?\? 'Active';/.test(protocol),
    'cards no longer resolve a status to draw'
  );
  assert.ok(/\{status\}/.test(protocol), 'the status word is no longer drawn');
  assert.ok(
    /status === 'Active' \? 'Paused' : 'Active'/.test(protocol),
    'tapping the status no longer toggles it'
  );
  assert.ok(
    /<MeCardRow row=\{row\} sections=\{sectionNames\}/.test(protocol),
    'sections render rows some other way, so the status may not reach all of them'
  );
  return 'drawn, togglable, and on the one row component';
});

check('A ME CARD IS NOT SAID TO BE IN THE ALMANAC', () => {
  // They share a table and nothing else. The old line said both at once -
  // "your Almanac, under Me" - which is the Almanac screen in Settings and the
  // Me tab described as though one contained the other.
  assert.ok(/Kept in your Me tab\./.test(pending), 'the confirmation no longer names the Me tab');
  assert.ok(
    !/Kept in your Almanac, under Me/.test(pending),
    'the confirmation still sends her to the Almanac for a Me card'
  );
  assert.ok(/'to their Me tab'/.test(pending), 'the waiting-offer prompt still says Almanac');
  return 'Me tab, in the confirmation and the offer';
});

check('and a care record names the heading she will read', () => {
  assert.ok(
    /Kept in Health Care Records, at the bottom of Me\./.test(pending),
    'the care confirmation names a heading that is no longer on screen'
  );
  assert.ok(
    /CARE_OFFER_QUESTION = 'Want me to keep that in your Health Care Records\?';/.test(pending),
    'the care offer still asks about How I Access Care'
  );
  return 'offer and confirmation both say the heading';
});

check('AND THE APP MAP DESCRIBES THE TAB AS IT IS', () => {
  // It said "the Health section has How I Access Care inside it", which stopped
  // being true on 12 October when care became its own section at the bottom,
  // and was still being read to the model today.
  assert.ok(
    !/the Health section has "How I Access Care" inside it/.test(structure),
    'the app map still describes the structure from 6 October'
  );
  assert.ok(/Details to Access Health Care/.test(structure), 'the map does not know the new heading');
  assert.ok(/Health Care Records/.test(structure), 'the map does not know the new heading');
  assert.ok(/Active, Paused/.test(structure), 'the map does not mention the status word');
  return 'both headings and the status word';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
