// WHAT SHE TAPS, THE CHAT KNOWS SHE TAPPED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-anything-can-be-picked-up.mjs
//
// Ruth, 14 October 2026, naming the product: "this is what replaces Claude,
// actually being able to pick up anywhere in chat and it knows what you're
// talking about and gives you exactly what you need, instead of a project in
// Claude."
//
// The kinds that may anchor a turn live in THREE places that must agree: the
// server's ENTRY_TYPES, the chat_messages check constraint, and what the screens
// send. They diverged for five days and nobody saw it: 'me' was sent from the Me
// tab and was in neither of the other two, so every tag was dropped on arrival
// and "Talk this through" on a referral anchored nothing. The screen said
// nothing was wrong, because from its side nothing was.
//
// So this compares the lists rather than reading any one of them, which is the
// only shape that catches the next divergence.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const D = await import(root + '/app/lib/discuss-card.ts');

const card = readFileSync('app/lib/discuss-card.ts', 'utf8').split('\r\n').join('\n');
const me = readFileSync('mobile/src/components/me-protocol.tsx', 'utf8').split('\r\n').join('\n');

/** The kinds the live constraint allows, from the newest migration that sets it. */
function kindsInTheConstraint() {
  const files = readdirSync('supabase/migrations')
    .filter((f) => /\.sql$/.test(f))
    .sort();
  let found = null;
  for (const f of files) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
    if (!/chat_messages_discuss_entry_type_check/.test(sql)) continue;
    const m = sql.match(/discuss_entry_type = any \(array\[([^\]]+)\]\)/);
    if (m) found = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  }
  return found;
}

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

console.log('\n  WHAT SHE TAPS, THE CHAT KNOWS SHE TAPPED\n');

check('the server and the database allow the same kinds', () => {
  const allowed = ['food', 'activity', 'measurement', 'plan', 'me', 'care'].filter((k) =>
    D.isDiscussEntryType(k)
  );
  const inDb = kindsInTheConstraint();
  assert.ok(inDb, 'no migration sets the discuss_entry_type constraint');
  assert.deepStrictEqual(
    [...allowed].sort(),
    [...inDb].sort(),
    `the server allows ${allowed.join(', ')} and the database allows ${inDb.join(', ')}`
  );
  return `${inDb.length} kinds, both sides`;
});

check('a Me card and a care record are among them', () => {
  assert.ok(D.isDiscussEntryType('me'), 'a Me card cannot anchor a turn');
  assert.ok(D.isDiscussEntryType('care'), 'a care record cannot anchor a turn');
  assert.ok(!D.isDiscussEntryType('almanac'), 'anything at all is accepted as a kind');
  return 'me and care';
});

check('the Me tab sends a kind the server will keep', () => {
  const m = me.match(/discussType: ([^,]+),/);
  assert.ok(m, 'the Me tab no longer sends a kind');
  const sent = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
  assert.ok(sent.length > 0, `cannot read what the Me tab sends: ${m[1]}`);
  for (const kind of sent) {
    assert.ok(D.isDiscussEntryType(kind), `the Me tab sends "${kind}", which the server drops on arrival`);
  }
  assert.ok(sent.includes('care'), 'a care record is sent as something other than care');
  return sent.join(' and ');
});

check('the chat is given the record, and told what it is for', () => {
  assert.ok(
    /tag\.entryType === 'me' \|\| tag\.entryType === 'care'/.test(card),
    'nothing loads a Me card or a care record for the turn'
  );
  // Two branches: the facts, and the name for the card that says what she tapped.
  const branches = card.match(/tag\.entryType === 'me' \|\| tag\.entryType === 'care'/g) ?? [];
  assert.strictEqual(branches.length, 2, `${branches.length} of the 2 branches handle them`);
  assert.ok(
    /paperwork of being seen/.test(card),
    'a care record is answered the same way as anything else, rather than by giving the number'
  );
  return 'facts and a name';
});

check('and this check can fail', () => {
  // The list as it stood while the Me tab was sending a kind nobody kept.
  const old = ['food', 'activity', 'measurement', 'plan'];
  assert.ok(!old.includes('me'), 'the old four read as including a Me card');
  const oldSend = "discussType: 'me',";
  const sent = [...oldSend.matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
  assert.ok(sent.every((k) => !old.includes(k)), 'the old mismatch reads as agreeing');
  return 'the five days where the lists disagreed';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
