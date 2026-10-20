// THE EXPLAINER CANNOT QUIETLY STOP BEING TRUE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-flower-explainer.mjs
//
// Ruth, 20 October 2026: "an explanation of why it is those categories and how
// it's calculated might be useful in a collapsible below it."
//
// An explainer is the longest label in this app, and the week it was written
// was one long lesson in labels that had stopped matching the code: a prompt
// saying appointments were impossible after the diary shipped, an app map
// describing a Me tab from a fortnight earlier, a fold summary repeating the
// pager beneath it. A paragraph explaining a calculation is the most expensive
// version of that mistake, because somebody reads it and believes it.
//
// So every definition it shows is tied to SELODIA_SPEC.md Part Eight, "The six
// health dimensions", and this fails if the two drift.
//
// AND THERE ARE THINGS IT MUST NOT SAY. The spec's own methodology note:
// "Weightings are evidence-based calibrated estimates... the starting point for
// expert review, not the output of it. Specific weightings should not be cited
// in marketing materials until the expert review has been completed and
// published." An in-app explainer printing "running is 75% bone loading" is
// exactly that citation, so the numbers are banned here rather than trusted to
// stay out.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(
  pathToFileURL(path.join(process.cwd(), 'mobile', 'src', 'lib', 'flower-explainer.ts')).href
);
const { DIMENSION_NOTES, NOTE_ORDER, EXPLAINER_METHOD, EXPLAINER_EVIDENCE, EXPLAINER_UNLOGGED } =
  mod;

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

const spec = fs.readFileSync('mobile/SELODIA_SPEC.md', 'utf8');
const section = fs.readFileSync('mobile/src/components/balance-flower-section.tsx', 'utf8');
const now = fs.readFileSync('mobile/src/app/(tabs)/now/index.tsx', 'utf8');

/** The spec's six-dimension table, as {title: definition}. */
function specDimensions() {
  const at = spec.indexOf('### The six health dimensions');
  assert.ok(at > -1, 'the spec no longer has a six-dimension table');
  const table = spec.slice(at, spec.indexOf('### Weighting table', at));
  const out = {};
  for (const line of table.split('\n')) {
    const m = line.match(/^\|\s*([A-Za-z ]+?)\s*\|\s*#[0-9A-Fa-f]{6}\s*\|\s*(.+?)\s*\|$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

console.log('\n  WHAT THIS SHOWS, AND WHETHER IT IS STILL TRUE\n');

check('EVERY DEFINITION MATCHES THE SPEC, WORD FOR WORD', () => {
  const fromSpec = specDimensions();
  assert.strictEqual(
    Object.keys(fromSpec).length,
    6,
    `parsed ${Object.keys(fromSpec).length} dimensions out of the spec, not 6`
  );
  for (const d of NOTE_ORDER) {
    const note = DIMENSION_NOTES[d];
    assert.ok(note, `${d} has no note`);
    const specText = fromSpec[note.title];
    assert.ok(specText, `the spec has no row titled "${note.title}"`);
    assert.strictEqual(
      note.spec,
      specText,
      `"${note.title}" has drifted from the spec:\n            app:  ${note.spec}\n            spec: ${specText}`
    );
  }
  return '6 of 6, verbatim';
});

check('and the plain wording is a rewrite, not a copy of the spec', () => {
  // If plain === spec somebody has shortcut the point of having two fields and
  // the screen is showing citation numbers and clinical nouns.
  for (const d of NOTE_ORDER) {
    const { title, spec: s, plain } = DIMENSION_NOTES[d];
    assert.notStrictEqual(plain, s, `"${title}" shows the spec text raw`);
    assert.ok(!/\[\d+\]/.test(plain), `"${title}" shows a citation number`);
    assert.ok(plain.length > 20, `"${title}" has no plain wording worth reading`);
  }
  return 'six rewritten, no citation marks';
});

check('THE WEIGHTINGS ARE NEVER QUOTED', () => {
  // The embargo in the spec's methodology note. A percentage anywhere in this
  // copy is the cited weighting it forbids.
  const all = [
    EXPLAINER_METHOD,
    EXPLAINER_EVIDENCE,
    EXPLAINER_UNLOGGED,
    ...NOTE_ORDER.map((d) => DIMENSION_NOTES[d].plain),
  ].join(' ');
  assert.ok(!/\d+\s*%/.test(all), 'a percentage is shown, which the spec embargoes until review');
  // And the target, which is "a choice, not a measurement" that "will want
  // tuning" - a number in prose rots the day it is tuned.
  assert.ok(!/\b200\b/.test(all), 'the coverage target is quoted, and it is going to change');
  return 'no percentages, no target';
});

check('AND IT SAYS WHERE THE NUMBERS STAND', () => {
  // Ruth took this call: say the weightings are estimates under review. It is
  // the honest status, and for an app aimed at women who have been fobbed off
  // it reads as trust rather than weakness.
  assert.ok(/expert review/i.test(EXPLAINER_EVIDENCE), 'the review status is no longer said');
  assert.ok(/estimate/i.test(EXPLAINER_EVIDENCE), 'the numbers are presented as settled');
  return 'estimate, and under review';
});

check('IT ADMITS WHAT IT CANNOT SEE, IN HER EXAMPLES', () => {
  // Ruth: "some activity may not be counted unless it's been logged, and some
  // of daily life like pushing a loaded pram up a hill or running up and down
  // tube escalators might be adding to the full picture."
  //
  // HER EXAMPLES RATHER THAN "INCIDENTAL ACTIVITY", which is the phrase a
  // health app reaches for and which names nothing anybody recognises.
  assert.ok(/logged/i.test(EXPLAINER_UNLOGGED), 'it does not say the drawing is of what was logged');
  assert.ok(/pram/i.test(EXPLAINER_UNLOGGED), 'her pram example is gone');
  assert.ok(/escalator/i.test(EXPLAINER_UNLOGGED), 'her escalator example is gone');
  assert.ok(!/incidental/i.test(EXPLAINER_UNLOGGED), 'it has been tidied into jargon');
  // It names the way in rather than only the gap.
  assert.ok(/Week/.test(EXPLAINER_UNLOGGED), 'it does not say a regular thing can go in the Week');
  // AND IT MUST NOT CLAIM THE WEEK COUNTS. Ruth, an hour after this shipped:
  // "nothing gets counted from Plans unless it's logged, it's merely a planning
  // tool." The code agrees - the Week writes no coverage anywhere and nothing
  // reads it for the flower. The first version said "it can live in your Week
  // and count from then on", which is the exact fault this app has spent a week
  // fixing, committed inside the sentence meant to be the honest one.
  //
  // It stays wrong after the Week gains a flower of its own: that one will show
  // what a PLAN covers. Only logging reaches this drawing.
  assert.ok(
    !/Week[^.]*\bcount/i.test(EXPLAINER_UNLOGGED),
    'the copy says the Week counts towards the flower, and it does not'
  );
  assert.ok(
    /logging/i.test(EXPLAINER_UNLOGGED),
    'it no longer says that logging is the thing that counts'
  );
  return 'logged, pram, escalators, the way in, and no false claim';
});

check('AND THE WEEK IS A LIVE LINK, NOT A MENTION', () => {
  // Ruth: it "needs a live link to it, so they're not left to fend for
  // themselves". Plans opens on the Week segment already, so this lands where
  // the sentence says it will.
  assert.ok(/EXPLAINER_WEEK_LINK/.test(section), 'the link is not drawn');
  assert.ok(
    /router\.push\('\/\(tabs\)\/plans'\)/.test(section),
    'the link does not go to Plans, where the Week lives'
  );
  return 'a real route, landing on the Week';
});

check('THE SECTION IS NOT CALLED AFTER ONE OF ITS OWN PETALS', () => {
  // The fault that started this: a section called Balance containing a petal
  // called Balance.
  const titleMatch = now.match(/<FoldSection\s+title="([^"]+)"\s+summary=\{flowerLabel\}/);
  assert.ok(titleMatch, 'the flower section has no title, or it moved');
  const title = titleMatch[1];
  assert.strictEqual(title, "What's protecting you", `the section is called "${title}"`);
  for (const d of NOTE_ORDER) {
    assert.ok(
      !new RegExp(`\\b${DIMENSION_NOTES[d].title.split(' ')[0]}\\b`, 'i').test(title),
      `the section name contains the petal name "${DIMENSION_NOTES[d].title}"`
    );
  }
  return `"${title}", clashing with none of the six`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
