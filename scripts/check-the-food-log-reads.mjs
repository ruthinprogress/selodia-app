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
  // SIZED AGAINST THE LOG, not against a scale. Her instruction after the
  // third attempt: "They only need to be a tiny bit bigger than the food log
  // table text font size." The day rows are `small`, which is 14, so the
  // ceiling is one step above that and not a round number somebody liked.
  const LOG_BODY = 14;
  assert.ok(
    Number(size[1]) > LOG_BODY && Number(size[1]) <= LOG_BODY + 4,
    `the figures are ${size[1]}px against a log body of ${LOG_BODY}px`
  );
  return `${size[1]}px figures`;
});

check('AND THE DANGLING RULE CANNOT COME BACK, BECAUSE THERE ARE NO RULES', () => {
  // This check used to assert that the hairlines were worked out per row. They
  // were drawn before every column but the first, so every wrapped line began
  // with one hanging off its left edge, and the fix was index arithmetic.
  //
  // The rules are gone now. They were right in her artwork, which puts six
  // figures in ONE line where a rule separates; around a grid they are a
  // lattice, and a lattice is weight - which is what "overbearing" was
  // describing. Whitespace separates these perfectly well and weighs nothing.
  //
  // So the assertion is MOVED rather than removed, as the one defending the
  // rules screen's tap-twice confirm was. Deleting a check when its behaviour
  // changes leaves nothing guarding the new behaviour - and here the new
  // behaviour is strictly stronger: with no rules there is no index to get
  // wrong, so the bug class is gone rather than guarded.
  assert.ok(!/borderLeftWidth/.test(card), 'the hairlines are back, and so is the bug they carried');
  assert.ok(!/i % PER_ROW/.test(card), 'something is being drawn per row position again');
  // The cells are still a fixed share, so columns line up down the card.
  assert.ok(/width: `\$\{100 \/ PER_ROW\}%`/.test(card), 'the cells are no longer an even share');
  return 'no rules, no arithmetic, no dangling anything';
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

check('THE NUTRIENT MARKS ARE IN THE HOUSE STYLE', () => {
  // Ruth, 22 October 2026: "icons are inconsistent and not on brand - worth
  // getting Chatgpt to make a set here?"
  //
  // She was right about the inconsistency, and the app already answers the
  // question: there is a house style, with three sets drawn in it already -
  // measurement-icon, drink-icons, food-category-icon. A 24-square, no fills,
  // 1.4 stroke, round caps, one colour passed in.
  //
  // What was here instead was ten Material glyphs picked one at a time: a sun,
  // a laboratory molecule, a droplet, a droplet with a percent sign, a stalk
  // of barley and a salt cellar are five drawing languages, and no amount of
  // tinting makes them one.
  const icon = fs.readFileSync('mobile/src/components/nutrient-icon.tsx', 'utf8');
  assert.ok(/viewBox="0 0 24 24"/.test(icon), 'the marks are not on the 24 grid the others use');
  assert.ok(/strokeWidth: 1\.4/.test(icon), 'the stroke is not the house weight');
  assert.ok(/strokeLinecap: 'round'/.test(icon), 'the caps are not round');
  assert.ok(/fill: 'none'/.test(icon), 'the marks are filled');
  // And no glyph family is reached for alongside them, which is how the
  // inconsistency arrived in the first place.
  const row = fs.readFileSync('mobile/src/components/nutrient-row.tsx', 'utf8');
  assert.ok(!/MaterialCommunityIcons/.test(row), 'a Material glyph is back among the drawn marks');
  return '24 grid, 1.4 stroke, no fills';
});

check('AND EVERY NUTRIENT HAS ONE', () => {
  // A row whose badge is empty is worse than a row with the wrong icon: it
  // reads as a drawing that failed to load.
  const icon = fs.readFileSync('mobile/src/components/nutrient-icon.tsx', 'utf8');
  const missing = MACROS.filter((m) => !new RegExp(`macroKey === '${m.key}'`).test(icon)).map((m) => m.key);
  assert.deepStrictEqual(missing, [], `no mark drawn for: ${missing.join(', ')}`);
  return `${MACROS.length} marks`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
