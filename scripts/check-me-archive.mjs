// CLOSED, AND STILL HERE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-me-archive.mjs
//
// Ruth, 20 October 2026, scoping the Me tab:
//
//   "I'd like for all records to have the active/paused."
//   "Active get moved to the top of the list, paused next, inactive get stored
//    chronologically below."
//   "Some way to archive into a collapsible menu so it's not just a stressful
//    neverending list of ailments eventually."
//   "Closed. Which implies it can be open later."
//
// WHY THIS IS NOT TIDYING, and the reason is hers, written into care-admin.ts
// weeks earlier: "I don't want it prominent. I like that it sits with the rest
// of my life, so the app doesn't say my life is about health issues." A record
// of everything that has ever been wrong, never shortening, is the app saying
// exactly the thing it was built not to say.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const { byStatusThenRecent, lifecycleOf } = await import(
  pathToFileURL(path.join(process.cwd(), 'mobile', 'src', 'lib', 'me-archive-sort.ts')).href
);

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
const swipe = fs.readFileSync('mobile/src/components/swipe-to-delete.tsx', 'utf8');
const archive = fs.readFileSync('mobile/src/lib/me-archive.ts', 'utf8');
const archiveSort = fs.readFileSync('mobile/src/lib/me-archive-sort.ts', 'utf8');
const meTab = fs.readFileSync('mobile/src/app/(tabs)/me.tsx', 'utf8');

console.log('\n  A RECORD CAN BE CLOSED, AND COME BACK\n');

check('ACTIVE FIRST, PAUSED NEXT, NEWEST WITHIN EACH', () => {
  const rows = [
    { id: 'old-active', status: 'Active', when: '2026-01-01' },
    { id: 'paused-new', status: 'Paused', when: '2026-10-20' },
    { id: 'new-active', status: 'Active', when: '2026-10-19' },
    { id: 'paused-old', status: 'Paused', when: '2026-02-01' },
  ];
  assert.deepStrictEqual(
    byStatusThenRecent(rows).map((r) => r.id),
    ['new-active', 'old-active', 'paused-new', 'paused-old'],
    'the order is not active-then-paused, newest first inside each'
  );
  return 'both groups, both orders';
});

check('AND A RECORD WITH NO STATUS COUNTS AS ACTIVE', () => {
  // THE CASE THAT MATTERS, because nothing has ever written a status onto a
  // care record. Treating null as its own pile would put a third, unlabelled
  // group between the two she asked for - which is the list she is escaping.
  const rows = [
    { id: 'paused', status: 'Paused', when: '2026-10-20' },
    { id: 'care-letter', status: null, when: '2026-10-01' },
  ];
  assert.deepStrictEqual(
    byStatusThenRecent(rows).map((r) => r.id),
    ['care-letter', 'paused'],
    'a record with no status sorted below a paused one'
  );
  // And a status that is not one of the pair still ranks as active.
  const other = [
    { id: 'paused', status: 'Paused', when: '2026-10-20' },
    { id: 'taking', status: 'Taking', when: '2026-10-01' },
  ];
  assert.strictEqual(byStatusThenRecent(other)[0].id, 'taking', '"Taking" sorted as paused');
  return 'null and Taking both rank active';
});

check('THE LIFECYCLE IS SEPARATE FROM THE CARD STATUS', () => {
  // Two different facts that both look like "status". The card's own word
  // (Taking, Paused) lives in content; whether the record is in play at all is
  // the row column, which is the one the report builder reads.
  assert.strictEqual(lifecycleOf(null), 'active', 'a row with no status reads as closed');
  assert.strictEqual(lifecycleOf(undefined), 'active');
  assert.strictEqual(lifecycleOf('active'), 'active');
  assert.strictEqual(lifecycleOf('closed'), 'closed');
  // Anything unrecognised must read as active, never as closed: failing the
  // other way would hide records nobody archived.
  assert.strictEqual(lifecycleOf('whatever'), 'active', 'an unknown status hides the record');
  return 'unknown reads as active, never hidden';
});

check('NOTHING CLOSES ITSELF', () => {
  // A record going quiet is not a knee getting better. The Week settled the
  // same argument: nothing there is ever marked done or missed.
  assert.ok(
    !/setInterval|Date\.now\(\)|daysSince|olderThan/.test(archive + archiveSort),
    'something in the archive reasons about elapsed time, which is how it would start closing records on its own'
  );
  assert.ok(
    /NOTHING EVER CLOSES ITSELF/.test(archive + archiveSort),
    'the rule is no longer written down'
  );
  return 'no clock in it at all';
});

check('IT WRITES THE COLUMN THE REPORT BUILDER READS', () => {
  // The whole point of her restructure was that nothing falls out of reports.
  // If this wrote some other flag, archived records would stay in the builder
  // and the two halves would drift apart silently.
  assert.ok(
    /\.update\(\{ status: closed \? 'closed' : 'active' \}\)/.test(archive),
    'the archive no longer writes almanac_entries.status'
  );
  assert.ok(/from\('almanac_entries'\)/.test(archive), 'it writes to some other table');
  assert.ok(/status'\)/.test(meTab), 'the Me tab does not read the status column, so nothing shows');
  return 'almanac_entries.status, read and written';
});

check('CLOSED RECORDS SIT UNDER A BAR, SHUT BY DEFAULT', () => {
  assert.ok(/Closed · \$\{closedRows\.length\}/.test(protocol), 'there is no closed bar');
  assert.ok(/closedRows/.test(protocol) && /openRows/.test(protocol), 'the two are not separated');
  // Shut by default: the store holds the SHUT ones, so a bar nobody has
  // touched is shut only if it is absent from that list - which it is, since
  // nothing adds it. The check that matters is that it is foldable at all and
  // keyed per section.
  assert.ok(
    /toggleSection\(`\$\{section\.name\}::closed`\)/.test(protocol),
    'the closed bar is not foldable, or not keyed per section'
  );
  assert.ok(
    /\.sort\(\(a, b\) => b\.updated_at\.localeCompare\(a\.updated_at\)\)/.test(protocol),
    'closed records are not in date order'
  );
  return 'per section, foldable, newest first';
});

check('AND CLOSING IS A SWIPE, BESIDE THE DELETE, NOT INSTEAD OF IT', () => {
  assert.ok(/onArchive\?: \(\) => Promise<void> \| void;/.test(swipe), 'the swipe has no second action');
  // THE GENTLER ONE FIRST, so a swipe that runs on too far meets the archive
  // rather than the bin.
  const archiveAt = swipe.indexOf('void archive()');
  const deleteAt = swipe.indexOf('void remove()');
  assert.ok(archiveAt > -1 && deleteAt > archiveAt, 'the delete sits inboard of the archive');
  // And archiving destroys nothing.
  const at = archive.indexOf('export async function setClosed');
  assert.ok(!/\.delete\(\)/.test(archive.slice(at)), 'closing a record deletes it');
  assert.ok(/archiveLabel="Open again"/.test(protocol), 'a closed record cannot be reopened');
  return 'two actions, archive inboard, nothing destroyed';
});

check('EVERY RECORD SHOWS A STATUS, AND A CLOSED ONE SAYS CLOSED', () => {
  // Ruth: "I'd like for all records to have the active/paused." Defaulted at
  // render and never written, so nothing backfills rows she already has.
  assert.ok(/const status = card\.status \?\? 'Active';/.test(protocol), 'a card can still show none');
  assert.ok(
    /DEFAULTED AT RENDER, NEVER WRITTEN/.test(protocol),
    'the reason it is not backfilled is no longer written down'
  );
  // A closed card must not also claim to be Active.
  const at = protocol.indexOf('{closed ? (');
  assert.ok(at > -1, 'a closed card does not say so');
  assert.ok(/Closed\s*\n\s*<\/ThemedText>/.test(protocol.slice(at, at + 400)), 'it does not say Closed');
  return 'defaulted, and Closed wins';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
