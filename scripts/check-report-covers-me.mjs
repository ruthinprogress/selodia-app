// EVERY RECORD IN THE ME TAB CAN GO IN A REPORT.
//
//   node scripts/check-report-covers-me.mjs
//
// Ruth, 20 October 2026, while restructuring the Me tab: "ALL ReCORDS must be
// selectable in Report Builder, thats exactly what I wanted to make sure during
// this restructure."
//
// She asked me to recheck, and the recheck found a fault that predated the
// restructure entirely. THE BUILDER DRAWS ITSELF FROM A LIST OF KINDS, so a
// kind that is not on the list is not missing from the screen - it was never
// drawn. 'care' was never on it. Seven of her records - a referral letter, an
// insurance claim, a consultant's confirming email, her practice's contact
// details - could not be put in a report at all, and nobody reports a tick box
// that was never there.
//
// AND TWO STATUS FILTERS WOULD HAVE EMPTIED IT AGAIN the day archiving shipped.
// The second was the dangerous one: it ran AFTER she ticked, so a closed record
// could be listed, ticked, shown as ticked, and then be missing from the
// finished document with nothing saying so. A report that quietly omits what
// somebody deliberately chose is worse than one that omits it openly, because
// she hands it over believing it is in there.

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

const report = fs.readFileSync('app/lib/report.ts', 'utf8');
const builder = fs.readFileSync('mobile/src/app/settings/report.tsx', 'utf8');
const careLib = fs.readFileSync('app/lib/care-admin.ts', 'utf8');

console.log('\n  THE REPORT CAN CARRY EVERYTHING IN ME\n');

check('EVERY KIND THE ME TAB SHOWS IS OFFERED BY THE BUILDER', () => {
  const list = report.match(/const CARD_KINDS = \[([^\]]+)\]/)?.[1] ?? '';
  const kinds = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  // The two kinds the Me tab actually renders. A card is kind 'me'; a health
  // care record is kind 'care'.
  assert.ok(kinds.includes('me'), 'Me cards are not offered in reports');
  assert.ok(
    kinds.includes('care'),
    'health care records are not offered in reports - the referral letters and claim references cannot be included at all'
  );
  return `${kinds.length} kinds, me and care among them`;
});

check('AND NOTHING IS FILTERED OUT BY ITS STATUS', () => {
  // Two filters, and the catalogue one is only half the fault.
  const bad = [...report.matchAll(/\(e\.status \?\? 'active'\) === 'active'/g)];
  // One occurrence is legitimate: the line that MARKS a record closed. A filter
  // is the thing being banned, so look for the shape of a filter.
  assert.ok(
    !/\.filter\(\(e\) => \(e\.status \?\? 'active'\) === 'active'\)/.test(report),
    'records are filtered out by status again, so archiving silently empties the builder'
  );
  assert.ok(bad.length <= 1, 'more than one place reads the status - check what the extra one does');
  return 'no status filter in either query';
});

check('A CLOSED RECORD IS MARKED, SO IT CAN BE SHOWN AS CLOSED', () => {
  assert.ok(/closed\?: boolean;/.test(report), 'the catalogue cannot say a record is closed');
  assert.ok(/closed\?: boolean;/.test(builder), 'the phone does not carry the flag');
  assert.ok(
    /=== 'active' \? undefined : true/.test(report),
    'nothing sets the flag, so every record looks open'
  );
  return 'flagged on the way out';
});

check('AND IT IS LISTED RATHER THAN HIDDEN', () => {
  // LISTED, UNTICKED, TICKABLE. The difference between a choice and an
  // omission is whether she can see what she is leaving out.
  assert.ok(/\?\.filter\(\(r\) => !r\.closed\)/.test(builder), 'open records are no longer separated');
  assert.ok(/\?\.filter\(\(r\) => r\.closed\)/.test(builder), 'closed records are not drawn at all');
  assert.ok(/Closed, and still yours to include\./.test(builder), 'nothing says what the group is');
  // They must be real checkboxes, not a read-only list.
  const at = builder.indexOf("?.filter((r) => r.closed)");
  assert.ok(/<Checkbox/.test(builder.slice(at, at + 400)), 'closed records are shown but cannot be ticked');
  return 'own group, tickable, nothing ticked by default';
});

check('AND THE HONEST LINE ABOUT WHAT SELODIA HOLDS SURVIVED', () => {
  // The picker grew to include care records, and this is exactly the kind of
  // sentence that quietly stops being true when a section grows underneath it.
  // A care record holds the references and names she shared FROM a letter; it
  // is not the letter, and somebody handing this to a consultant must know.
  assert.ok(
    /Selodía holds no medical documents, scans or test results\./.test(builder),
    'the line saying Selodia holds no medical documents is gone'
  );
  assert.ok(!/title: 'Summaries'/.test(builder), 'a referral reference is still called a summary');
  return 'disclaimer intact, heading honest';
});

check('and the stored care kind still matches what the report asks for', () => {
  // The report selects by kind; the Me tab files by section. If the kind a care
  // record is SAVED under ever drifts from the one CARD_KINDS names, these
  // records fall out of reports again and nothing fails.
  assert.ok(/CARE_SECTION = 'How I Access Care'/.test(careLib), 'the stored care section moved');
  assert.ok(/'care'/.test(report), 'the report no longer names the care kind');
  return 'kind and section both where the other expects';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
