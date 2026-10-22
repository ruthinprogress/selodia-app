// EIGHT NUMBERS IN A SENTENCE IS A SENTENCE NOBODY FINISHES.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-food-log-reads.mjs
//
// Ruth's artwork for the food log, 22 October 2026, and her instruction with
// it: "Don't change functionality except that nutrients page explainer is
// collapsible rows, not a long list of unreadable pills."
//
// Two screens, two faults, and both of them are about READING rather than
// about what the app does:
//
//   THE WEEK'S AVERAGE was one running line - "1,045 kcal · 60 g protein ·
//   43 g fat · 16 g saturated fat · 98 g carbohydrates · 29 g sugar · 11 g
//   fibre · 2.8 g salt". Every figure she asked for, in the order she asked
//   for them, and unreadable. Her drawing lays them out as columns.
//
//   THE NUTRIENTS PAGE was ten open cards of three paragraphs each. You could
//   not find fibre without reading about saturated fat on the way.
//
// WHAT THIS GUARDS IS THE READING, which is harder to hold than behaviour and
// quietly decays - a figure added here, a paragraph there, and the sentence is
// back. So: the subordinate macros stay subordinate, the shut row answers by
// itself, and the averages are real arithmetic rather than a prettier string.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { MACROS, averageLine, macroFigure } = await import(here('mobile/src/lib/tracked-macros.ts'));
const { MACRO_EXPLAINERS } = await import(here('mobile/src/lib/macro-explainers.ts'));

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

const card = fs.readFileSync('mobile/src/components/week-average-card.tsx', 'utf8');
const row = fs.readFileSync('mobile/src/components/nutrient-row.tsx', 'utf8');

console.log('\n  THE FOOD LOG READS\n');

check('THE WEEK COMES BACK AS FIGURES, NOT ONLY A SENTENCE', () => {
  // Two days, so the average is arithmetic rather than a copy of one day.
  const days = [
    [{ kcal: 600, protein_g: 40, fat_g: 20, sodium_mg: 800 }],
    [{ kcal: 800, protein_g: 60, fat_g: 30, sodium_mg: 1200 }],
    [],
  ];
  const week = averageLine(days, ['kcal', 'protein', 'fat', 'salt']);
  assert.strictEqual(week.daysLogged, 2, 'the empty day was counted');
  assert.ok(week.averages, 'the figures are not returned at all');
  assert.strictEqual(week.averages.kcal, 700, `kcal averaged to ${week.averages.kcal}`);
  assert.strictEqual(week.averages.protein_g, 50);
  // SALT GOES BACK TO SODIUM on the way out, because macroFigure converts on
  // the way in and would otherwise convert a figure that was already converted.
  assert.strictEqual(macroFigure('salt', week.averages), '2.5 g', macroFigure('salt', week.averages));
  return '700 kcal, 50 g protein, 2.5 g salt';
});

check('AND A MACRO NOBODY WORKED OUT IS STILL ABSENT', () => {
  // The rule the whole file turns on: a missing figure is left out, never
  // shown as zero, because the app cannot tell "no fibre" from "no answer".
  const week = averageLine([[{ kcal: 500 }]], ['kcal', 'fibre']);
  assert.strictEqual(week.averages.fibre_g, undefined, 'an unworked macro got an average');
  assert.strictEqual(macroFigure('fibre', week.averages), null);
  return 'absent stays absent';
});

check('SATURATED FAT AND SUGAR STAY SUBORDINATE', () => {
  // The one hierarchy in the card, and the thing that stops eight columns
  // reading as eight equals. Saturated fat belongs to fat; sugar to carbs.
  assert.ok(/saturated: 'fat'/.test(card), 'saturated fat is drawn as its own column');
  assert.ok(/sugar: 'carbs'/.test(card), 'sugar is drawn as its own column');
  // And they are excluded from the top-level columns rather than merely styled.
  assert.ok(/!UNDER\[m\.key\]/.test(card), 'the subordinates are still given columns of their own');
  return 'two nested, the rest in columns';
});

check('THE CARD IS A CARD, NOT A PAGE', () => {
  // Ruth's screenshot, 22 October 2026, and one word: "This is not good."
  //
  // The figures were `title` - 32px, the size meant for a screen's name - used
  // eight times in one card. It filled the phone and left a single day row
  // visible underneath it. Size discipline is not a style preference here: the
  // card exists so the week can be read ON THE WAY to the log, and a card that
  // hides the log has eaten the thing it was summarising.
  assert.ok(!/type="title"/.test(card), 'the figures are back at 32px');
  assert.ok(!/type="sectionTitle"/.test(card), 'the figures are at heading size');
  const size = /figure: \{ fontSize: (\d+)/.exec(card);
  assert.ok(size, 'the figure size is no longer stated in one place');
  assert.ok(Number(size[1]) <= 24, `the figures are ${size[1]}px`);
  return `${size[1]}px figures`;
});

check('AND NO ROW BEGINS WITH A DANGLING RULE', () => {
  // The second fault in the same screenshot, and the subtler one. The hairline
  // was drawn before every column except the very FIRST, which is right for
  // one row and wrong for every row after it - so each wrapped line began with
  // a rule hanging off its left edge.
  //
  // The rule belongs to a cell's left edge and is drawn from the index, which
  // is arithmetic rather than a guess about where the text wrapped.
  assert.ok(/i % PER_ROW !== 0/.test(card), 'the dividers are not worked out per row');
  assert.ok(!/i > 0 &&/.test(card), 'the divider is still drawn before every cell but the first');
  // And the cells are a fixed share, so columns line up down the card rather
  // than with whatever happened to be above them.
  assert.ok(/width: '33\.33%'/.test(card), 'the cells are no longer a fixed third');
  return 'a rule between, never before';
});

check('AND THE CARD WRAPS RATHER THAN SCROLLING SIDEWAYS', () => {
  // Six columns do not fit a phone in one line, and a row that scrolls
  // sideways hides figures behind an edge nobody thinks to drag.
  assert.ok(/flexWrap: 'wrap'/.test(card), 'the figures do not wrap');
  assert.ok(!/horizontal/.test(card), 'the figures scroll sideways');
  return 'wraps';
});

check('EVERY NUTRIENT ANSWERS WITH ITS ROW SHUT', () => {
  // The change she asked for. Shut, a row has to say what the nutrient is -
  // otherwise it is a list of ten words and ten chevrons.
  const missing = MACROS.filter((m) => !MACRO_EXPLAINERS[m.key]?.line).map((m) => m.key);
  assert.deepStrictEqual(missing, [], `no one-line summary: ${missing.join(', ')}`);
  for (const [key, e] of Object.entries(MACRO_EXPLAINERS)) {
    assert.ok(e.line.length < 60, `${key}'s line is too long to read at a glance: "${e.line}"`);
    assert.ok(/[.!]$/.test(e.line), `${key}'s line does not end in a stop: "${e.line}"`);
    // It must SAY something, not repeat the name back.
    assert.ok(!new RegExp(`^${key}\\b`, 'i').test(e.line), `${key}'s line just repeats the name`);
  }
  return `${MACROS.length} lines, all under 60 characters`;
});

check('AND THE ROWS ARE SHUT WHEN SHE ARRIVES', () => {
  // Ten open cards is what she called "a long list of unreadable pills". The
  // default is the whole fix.
  assert.ok(/useState\(false\)/.test(row), 'the rows start open');
  // HER CHEVRON RULE, not the artwork's. Asked about it directly, she said
  // keep the 14 October rule: closed points at the heading, open points down.
  assert.ok(/open \? 'chevron-down' : 'chevron-forward'/.test(row), 'the chevrons follow the drawing, not the rule');
  return 'shut, and pointing the right way';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
