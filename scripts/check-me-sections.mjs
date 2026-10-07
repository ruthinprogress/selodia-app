// A SHUT SECTION SAYS WHETHER THERE IS ANYTHING IN IT, AND STAYS SHUT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-me-sections.mjs
//
// Ruth, 7 October 2026: "I do like the idea of just a number to mark quietly how
// many items in each section, like you did in Body Manual", and then "yes,
// remember if sections were open".
//
// THE COUNT IS NOT DECORATION. The Body Manual learned this the hard way and
// wrote it down: a folded section showing a heading and nothing is
// "indistinguishable from an empty list". Her Plans goals section was shut one
// afternoon, read as empty, and cost her the time. The moment a section on the
// Me tab can fold, it inherits that fault exactly, so the count ships in the
// same change as the fold or not at all.
//
// AND THE POLARITY OF THE MEMORY IS THE PART THAT COULD HAVE GONE WRONG. The
// store records the sections she has SHUT. A list of OPEN ones would have had to
// mean "everything is shut" for every row that already exists, which would have
// folded every section of every account on the deploy.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { EMPTY, readLayout, layoutOf } = await import(root + '/mobile/src/lib/log-layout-rules.ts');

const me = readFileSync('mobile/src/components/me-protocol.tsx', 'utf8');

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

console.log('\n  THE ME TAB FOLDS, AND REMEMBERS\n');

check('a stored layout from before today still opens everything', () => {
  // THE DEPLOY TEST. Every me_layout row in the database right now was written
  // without a `closed` key.
  const old = readLayout({ order: ['Supplements', 'Health'], hidden: [] });
  assert.deepStrictEqual(old.closed, [], 'an older row comes back with sections already shut');
  assert.deepStrictEqual(old.order, ['Supplements', 'Health'], 'the order was lost');
  assert.deepStrictEqual(EMPTY.closed, [], 'the empty layout has something shut');
  return 'no closed key means nothing is shut';
});

check('a shut section round-trips', () => {
  const saved = layoutOf(['Health', 'Supplements'], [], ['Supplements']);
  const read = readLayout(saved);
  assert.deepStrictEqual(read.closed, ['Supplements'], 'the fold did not survive the store');
  assert.ok(read.order.includes('Supplements'), 'a shut section fell out of the order');
  // AND A SHUT SECTION IS NOT A HIDDEN ONE. Hidden removes it from the tab.
  assert.deepStrictEqual(read.hidden, [], 'shutting a section hid it instead');
  return 'closed survives, and is not hidden';
});

check('reordering does not reopen what she shut', () => {
  // The obvious way to write the reorder handler drops everything it does not
  // mention, and `closed` would have gone with it.
  const at = me.indexOf('const keep = useCallback');
  assert.ok(at > 0, 'the reorder handler has moved');
  const handler = me.slice(at, at + 700);
  assert.ok(
    /layoutOf\(order, \[\], layout\.closed\)/.test(handler),
    'the reorder saves without her folds, so dragging a section reopens all of them'
  );
  assert.ok(/\.\.\.prev/.test(handler), 'the reorder replaces the whole layout rather than updating it');
  return 'folds survive a drag';
});

check('the fold is saved on the tap, not on leaving', () => {
  const at = me.indexOf('const toggleSection');
  assert.ok(at > 0, 'there is no toggle at all');
  const toggle = me.slice(at, at + 800);
  assert.ok(/saveLayout\('me_layout'/.test(toggle), 'the fold is never written to the store');
  return 'written immediately';
});

check('a shut section carries a count', () => {
  assert.ok(
    /section\.rows\.length \+ section\.care\.length/.test(me),
    'the heading shows no count, so a shut section cannot be told from an empty one'
  );
  // The care records are inside the Health section, so the count has to include
  // them or Health reads as emptier than it is.
  assert.ok(/section\.care\.length/.test(me), 'the count ignores the care records');
  return 'rows plus care records';
});

check('the heading is the control and the body is behind it', () => {
  assert.ok(/onPress=\{\(\) => toggleSection\(section\.name\)\}/.test(me), 'the heading does not fold anything');
  assert.ok(/\{!isShut\(section\.name\) && \(/.test(me), 'the body renders whether or not the section is shut');
  assert.ok(
    /accessibilityState=\{\{ expanded: !isShut\(section\.name\) \}\}/.test(me),
    'a screen reader is not told whether the section is open'
  );
  return 'one target, and it says what it is';
});

check('the card names itself when it opens chat', () => {
  // Since 7 October chat draws the anchor on arrival, so a tag with no title
  // reads "Talking about this entry" over a card that has one.
  const at = me.indexOf('I would like to talk through');
  assert.ok(at > 0, 'the talk-this-through link has gone');
  // 700, not 400: the first version cut off at "seedTitle: row" and failed on
  // code that was correct. A fixed window over source is brittle by nature, so
  // it is set well past what the block needs rather than snugly around it.
  const link = me.slice(at, at + 700);
  assert.ok(/seedTitle: row\.title/.test(link), 'the card sends no title, so the anchor cannot name it');
  return 'the anchor says the card name';
});

check('and this check can fail', () => {
  // The shipped behaviour before today: no closed key at all.
  const asShipped = { order: ['Health'], hidden: [] };
  assert.ok(!('closed' in asShipped), 'the fixture is not the old shape');
  const read = readLayout(asShipped);
  assert.deepStrictEqual(read.closed, [], 'an old row is being read as having folds');
  // And a layout that claims a fold is distinguishable from one that does not.
  assert.notDeepStrictEqual(
    readLayout(layoutOf(['Health'], [], ['Health'])).closed,
    read.closed,
    'a shut section is indistinguishable from an open one'
  );
  return 'the old shape and the new one are told apart';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
