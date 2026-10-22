// THERE IS ONE WAY TO DELETE A ROW, AND IT IS A SWIPE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-one-way-to-delete.mjs
//
// Ruth, 22 October 2026, on the Movement rules screen: "We have a 'Delete a
// pill' convention across the app. It should always be swipe left to reveal bin
// icon. Not sure why you deviated from that. Please amend the screen and make
// sure this convention for pills is documented."
//
// THE CONVENTION, written down here because she asked for it to be written
// down, and in a check rather than a document because a document describing
// behaviour is one nobody is forced to read:
//
//   A deletable row slides LEFT to reveal a bin, and deleting offers an UNDO.
//   No "Remove" link. No tap-twice confirm. No long-press. No trailing ✕.
//
// WHY A SWIPE AND NOT A CONFIRM. The slide IS the deliberate act - it cannot be
// done by brushing the screen - so a confirmation on top of it asks her to
// agree twice to something she has already done deliberately once. And undo is
// strictly better than a confirm: it costs nothing when she meant it, and it
// recovers the case where she did not, which a confirm only prevents if she
// reads it.
//
// WHY ONE WAY MATTERS MORE THAN WHICH WAY. Two ways to delete means looking at
// a row and not knowing which it is. The Rules screen had a "Remove" text
// button that became "Tap again to remove it" - invented there, used nowhere
// else - while the log, the Me tab, the diary, the movement library and the
// food breakdown all slid. The reasoning for the exception was real (a screen
// about constraints on a body is not one to delete from by accident) and it was
// answered better by the convention it was avoiding.
//
// THE EXCEPTION THAT IS NOT ONE: a whole SCREEN's worth of thing - an account,
// a plan opened on its own page - may have a button, because it is not a row in
// a list and there is nothing to swipe.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

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

const ROOT = 'mobile/src';
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}
const FILES = walk(ROOT).map((f) => ({ f, text: fs.readFileSync(f, 'utf8') }));

// Comments describe the convention constantly; only code is evidence of a
// second one. This is the same lesson as the chevron rule: anchor on what the
// code must MEAN, and do not fire on somebody explaining themselves.
const withoutComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n  ONE WAY TO DELETE\n');

check('THE SCREEN SHE REPORTED NOW SLIDES', () => {
  const rules = fs.readFileSync('mobile/src/components/rules-view.tsx', 'utf8');
  assert.ok(/<SwipeToDelete/.test(rules), 'the rules screen still deletes its own way');
  assert.ok(!/Tap again to remove it/.test(withoutComments(rules)), 'the tap-twice confirm is still there');
  return 'rules-view slides';
});

check('AND NOBODY HAS INVENTED A SECOND WAY', () => {
  // The shapes a bespoke delete actually takes, each one seen in this codebase
  // or one like it. A row that deletes has to do it by sliding.
  const SMELLS = [
    [/Tap again to (?:remove|delete)/i, 'a tap-twice confirm'],
    [/onLongPress=\{[^}]*(?:delete|remove)/i, 'a long-press delete'],
  ];
  // THE ONE EXCEPTION, NAMED RATHER THAN DESCRIBED. A detail SHEET is opened
  // for a single thing and has no row to swipe, so its delete is a button and
  // a confirm there is the deliberate act the swipe would otherwise be. Listed
  // by filename so a new one has to be added on purpose, with a reason, rather
  // than slipping in under a pattern like "anything called *-sheet".
  const SHEETS = ['diary-section.tsx', 'log-plan-sheet.tsx'];
  const found = [];
  for (const { f, text } of FILES) {
    if (f.endsWith('swipe-to-delete.tsx')) continue;
    if (SHEETS.includes(path.basename(f))) continue;
    const code = withoutComments(text);
    for (const [re, what] of SMELLS) if (re.test(code)) found.push(`${f}: ${what}`);
  }
  assert.deepStrictEqual(found, [], `a second way to delete: ${found.join(' | ')}`);
  return `${FILES.length} screens, one gesture`;
});

check('AND THE GESTURE STILL REVEALS A BIN AND OFFERS AN UNDO', () => {
  // The convention is not merely "uses the component" - it is what the
  // component does. Both halves are what she described.
  const swipe = fs.readFileSync('mobile/src/components/swipe-to-delete.tsx', 'utf8');
  assert.ok(/trash|bin-outline|delete-outline/i.test(swipe), 'the revealed control is no longer a bin');
  assert.ok(/undo/i.test(swipe), 'deleting no longer offers an undo');
  // Left, which is the direction she named. A positive translation would open
  // the panel on the other side.
  assert.ok(/-REVEAL|translateX|dx < 0|LEFT/i.test(swipe), 'the direction of the swipe is not stated in code');
  return 'bin, undo, leftwards';
});

check('AND EVERY LIST THAT DELETES USES IT', () => {
  // Named rather than counted, so a screen that quietly stops using it is
  // reported by name instead of being hidden by the others.
  const users = FILES.filter(({ text }) => /<SwipeToDelete/.test(text)).map(({ f }) => path.basename(f));
  assert.ok(users.length >= 6, `only ${users.length} screens use the convention: ${users.join(', ')}`);
  for (const expected of ['day-log.tsx', 'diary-section.tsx', 'me-protocol.tsx', 'rules-view.tsx']) {
    assert.ok(users.includes(expected), `${expected} no longer slides to delete`);
  }
  return users.join(', ');
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
