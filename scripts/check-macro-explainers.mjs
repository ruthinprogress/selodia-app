// WHAT A NUTRIENT IS FOR, WRITTEN ONCE AND NEVER GENERATED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-macro-explainers.mjs
//
// Ruth, 21 October 2026, on two artworks for the food log: "it does need some
// improvement to increase user literacy of what they are eating and how it's
// affecting them... But keeping in mind we need to maintain it, keep costs
// realistic for MVP, and start moving towards shipping, not constant
// rebuilding."
//
// Both artworks reached for the same idea - a short explanation of a nutrient,
// reached from the figure. The other half of artwork 1 generates an insight
// from the day's food, which is a model call per person per day forever, and
// she called that one a fantasy.
//
// WHAT THIS CHECK IS REALLY FOR, and it is not spelling. These paragraphs are
// shown to everybody who installs the app, about food, which is a subject where
// a careless sentence does harm. Three rules, and all three are about the
// difference between teaching somebody what a nutrient does and telling them
// what to eat:
//
//   NO TARGETS. A number here reads as hers, and the published guidance lives
//   on the server beside the chat, which can put it against her actual days.
//   A figure in a fixed paragraph can only ever be generic, and somebody will
//   read it as advice about themselves.
//
//   NO INSTRUCTIONS. "You should", "aim for", "try to" - the app does not know
//   what she needs and it is not her clinician.
//
//   NO JUDGEMENT ABOUT A FOOD. "Bad", "unhealthy", "junk". An app that keeps a
//   record of somebody's eating and calls part of it bad is doing something
//   other than keeping a record.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { MACRO_EXPLAINERS, explainerFor } = await import(here('mobile/src/lib/macro-explainers.ts'));
const { MACROS } = await import(here('mobile/src/lib/tracked-macros.ts'));

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

const all = Object.entries(MACRO_EXPLAINERS);
const text = all.flatMap(([, v]) => [v.what, v.where]).join(' ');

console.log('\n  WHAT EACH NUTRIENT IS FOR\n');

check('EVERY MACRO THE APP OFFERS HAS ONE', () => {
  // A macro she can switch on and then tap, with nothing behind it, is a dead
  // control - and the list it is drawn from is the same list the toggles use,
  // so the next macro added gets caught here rather than on her screen.
  const missing = MACROS.map((m) => m.key).filter((k) => !explainerFor(k));
  assert.deepStrictEqual(missing, [], `no explainer for: ${missing.join(', ')}`);
  for (const [key, v] of all) {
    assert.ok(v.what.length > 120, `${key}'s explanation is too short to explain anything`);
    assert.ok(v.where.length > 20, `${key} does not say where it comes from`);
  }
  return `${all.length} nutrients, all written`;
});

check('AND NONE OF THEM SETS HER A TARGET', () => {
  // The published figures live on the server, where the chat can put them
  // against her real days. A number in a fixed paragraph can only be generic,
  // and it will be read as being about her.
  const numbers = [...text.matchAll(/\b\d+\s*(?:g|mg|kcal|grams|milligrams)\b/gi)].map((m) => m[0]);
  assert.deepStrictEqual(numbers, [], `a figure that reads as a target: ${numbers.join(', ')}`);
  for (const word of ['you should', 'aim for', 'aim to', 'make sure you', 'try to get', 'needs to be']) {
    assert.ok(!new RegExp(word, 'i').test(text), `it instructs her: "${word}"`);
  }
  return 'no figures, no instructions';
});

check('AND NONE OF THEM CALLS A FOOD BAD', () => {
  // An app that keeps a record of somebody's eating and calls part of it bad is
  // doing something other than keeping a record.
  for (const word of ['unhealthy', 'bad for', 'junk', 'guilty', 'cheat', 'clean eating', 'empty calories']) {
    assert.ok(!new RegExp(word, 'i').test(text), `it judges a food: "${word}"`);
  }
  // Nor does it promise an outcome, which is the other way a sentence like
  // this goes wrong - "supports immune health" is a claim nobody can check.
  for (const word of ['cures', 'prevents', 'boosts your immune', 'detox']) {
    assert.ok(!new RegExp(word, 'i').test(text), `it promises an outcome: "${word}"`);
  }
  return 'no judgement, no promises';
});

check('THE TWO TRAPS ARE NAMED WHERE THEY BELONG', () => {
  // Spinach is famous for iron and for calcium and well absorbed for neither,
  // and it is exactly the food somebody reads this page to check.
  assert.ok(/[Ss]pinach/.test(MACRO_EXPLAINERS.calcium.where), 'calcium does not mention spinach');
  assert.ok(/absorb/i.test(MACRO_EXPLAINERS.iron.where), 'iron says nothing about absorption');
  // And iron names the reason she asked for it at all.
  assert.ok(/period/i.test(MACRO_EXPLAINERS.iron.what), 'iron does not say why it is lost monthly');
  // Calcium names bone as the place a long shortfall shows, which is the whole
  // reason it matters to this app's readers.
  assert.ok(/[Bb]one/.test(MACRO_EXPLAINERS.calcium.what), 'calcium does not mention bone');
  return 'spinach, absorption, periods, bone';
});

check('AND NOTHING HERE IS GENERATED', () => {
  // The cost test, which is the constraint she set. This file must stay a file.
  const src = fs.readFileSync('mobile/src/lib/macro-explainers.ts', 'utf8');
  assert.ok(!/fetch\(|authedPost|authedGet|anthropic|\/api\//i.test(src), 'the explainers reach the network');
  assert.ok(!/useState|useEffect/.test(src), 'the explainers are no longer plain data');
  return 'a file, read forever, costing nothing';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
