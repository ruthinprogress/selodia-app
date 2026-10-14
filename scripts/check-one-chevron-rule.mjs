// AN ARROW POINTS AT THE HEADER, THEN DOWN WHEN IT IS OPEN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-one-chevron-rule.mjs
//
// Ruth, 14 October 2026, on the Me tab: "The Me tab drop down arrows are
// different on the sub-sections and very confusing. The need to point to the
// header and then point down when open."
//
// She was looking at one screen with two conventions on it. Its SECTIONS used
// chevron-forward when shut and chevron-down when open, which is the rule. Its
// CARDS used chevron-down when shut and chevron-up when open, so on the same
// screen a down arrow meant "this is closed" in one place and "this is open"
// in the other. Four other components had drifted the same way.
//
// THE RULE, AND IT IS HERS: closed points AT the heading (chevron-forward),
// open points DOWN (chevron-down). chevron-up is never an expander here, which
// is what makes this checkable: one forbidden name rather than a reading of
// every condition's sense.
//
// A plain chevron-forward with no condition is a LINK that goes somewhere, not
// an expander, and is left alone.

import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = 'mobile/src';

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
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

const all = files(SRC).map((f) => ({ f, text: readFileSync(f, 'utf8') }));

console.log('\n  AN ARROW POINTS AT THE HEADER, THEN DOWN WHEN IT IS OPEN\n');

check('nothing uses chevron-up', () => {
  const guilty = all.filter((x) => /chevron-up/.test(x.text)).map((x) => x.f);
  assert.deepStrictEqual(guilty, [], `an up arrow is an expander somewhere: ${guilty.join(', ')}`);
  return 'no up arrows';
});

check('every expander pairs forward with down', () => {
  // A ternary choosing between two chevrons must choose between exactly these
  // two. Anything else is a third convention arriving.
  const pair = /\?\s*'(chevron-[a-z]+)'\s*:\s*'(chevron-[a-z]+)'/g;
  const wrong = [];
  for (const { f, text } of all) {
    for (const m of text.matchAll(pair)) {
      const both = [m[1], m[2]].sort().join('+');
      if (both !== 'chevron-down+chevron-forward') wrong.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepStrictEqual(wrong, [], `a different pair is in use: ${wrong.join(' | ')}`);
  const count = all.reduce((n, x) => n + [...x.text.matchAll(pair)].length, 0);
  return `${count} expanders, all the same pair`;
});

check('the Me tab section and its cards agree', () => {
  // The screen she was looking at, held explicitly: two conventions on one
  // screen is what she reported, and a count elsewhere would not catch it.
  const me = readFileSync('mobile/src/components/me-protocol.tsx', 'utf8');
  const uses = [...me.matchAll(/\?\s*'(chevron-[a-z]+)'\s*:\s*'(chevron-[a-z]+)'/g)];
  assert.ok(uses.length >= 2, 'the Me tab no longer has both a section and a card arrow');
  assert.ok(/isShut\(section\.name\) \? 'chevron-forward' : 'chevron-down'/.test(me), 'the section arrow has changed sense');
  assert.ok(/open \? 'chevron-down' : 'chevron-forward'/.test(me), 'the card arrow does not follow the section');
  return `${uses.length} arrows, one rule`;
});

check('and this check can fail', () => {
  const old = "name={open ? 'chevron-up' : 'chevron-down'}";
  assert.ok(/chevron-up/.test(old), 'the old card arrow reads as clean');
  const pair = /\?\s*'(chevron-[a-z]+)'\s*:\s*'(chevron-[a-z]+)'/;
  const m = old.match(pair);
  assert.notStrictEqual([m[1], m[2]].sort().join('+'), 'chevron-down+chevron-forward');
  return 'the old down/up pair is caught';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
