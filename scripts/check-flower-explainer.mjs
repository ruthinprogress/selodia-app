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
const {
  EXPLAINER_TITLE,
  DIMENSION_NOTES,
  NOTE_ORDER,
  EXPLAINER_INTRO,
  EXPLAINER_METHOD,
  EXPLAINER_UNLOGGED,
  EXPLAINER_WEEK,
} = mod;

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

// NORMALISED, because a table parsed with a line anchor is broken by a stray
// carriage return - and on 23 October a spec edit flipped the whole file to
// CRLF, so this check reported that the six-dimension table had vanished.
// The table was fine. The check was reading it through the wrong newline.
const spec = fs.readFileSync('mobile/SELODIA_SPEC.md', 'utf8').replace(/\r/g, '');
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
    EXPLAINER_INTRO,
    EXPLAINER_METHOD,
    EXPLAINER_UNLOGGED,
    EXPLAINER_WEEK,
    ...NOTE_ORDER.map((d) => DIMENSION_NOTES[d].plain),
  ].join(' ');
  assert.ok(!/\d+\s*%/.test(all), 'a percentage is shown, which the spec embargoes until review');
  // And the target, which is "a choice, not a measurement" that "will want
  // tuning" - a number in prose rots the day it is tuned.
  assert.ok(!/\b200\b/.test(all), 'the coverage target is quoted, and it is going to change');
  return 'no percentages, no target';
});

check('AND THE COPY CANNOT OVERSTATE WHAT IT KNOWS', () => {
  // THIS USED TO CHECK THE OPPOSITE. Until 21 October 2026 the explainer
  // volunteered that the weightings are "our own calibrated estimate, and is
  // going out for expert review", and this asserted that sentence was present.
  // Ruth took it out, on the argument that the user does not need the internal
  // model and that leading with uncertainty makes a feature feel less
  // confident before anybody has used it.
  //
  // WHAT THE EMBARGO FORBIDS IS UNCHANGED, and it is the half worth guarding:
  // Part Eight says specific weightings must not be cited until the review is
  // published. Dropping a sentence about uncertainty is allowed; printing a
  // number is not, and the check above is that guard.
  //
  // So this checks the other half - that the copy does not claim the certainty
  // it has just stopped disclaiming.
  const all = [
    EXPLAINER_INTRO,
    EXPLAINER_METHOD,
    EXPLAINER_UNLOGGED,
    EXPLAINER_WEEK,
    ...NOTE_ORDER.map((d) => DIMENSION_NOTES[d].plain),
  ].join(' ');
  for (const overclaim of [/\bproven\b/i, /\bclinically\b/i, /\bguarantee/i, /\bscientifically\b/i]) {
    assert.ok(!overclaim.test(all), `the explainer claims ${overclaim} without the review behind it`);
  }
  return 'no claim the review has not earned';
});

check('IT ADMITS WHAT IT CANNOT SEE, IN HER EXAMPLES', () => {
  // Ruth: "some activity may not be counted unless it's been logged, and some
  // of daily life like pushing a loaded pram up a hill or running up and down
  // tube escalators might be adding to the full picture."
  //
  // HER EXAMPLES RATHER THAN "INCIDENTAL ACTIVITY", which is the phrase a
  // health app reaches for and which names nothing anybody recognises.
  // THE EXAMPLES WENT ON 21 OCTOBER 2026, and the point they made stayed.
  // "It's charming, but it's long and specific. A general statement ('Everyday
  // movement counts too') achieves the same thing in one sentence." Ruth took
  // that, and the page is now meant to read "like an exhibit in a museum:
  // simple, calm and slightly intriguing".
  //
  // SO WHAT IS CHECKED IS THE ADMISSION, NOT THE ANECDOTE. The drawing shows
  // what was logged rather than everything that was done, and everyday
  // movement counts when it is logged - that claim is the whole reason this
  // paragraph exists, and losing it would turn a thin flower back into a
  // verdict on somebody's week.
  assert.ok(/logged/i.test(EXPLAINER_UNLOGGED), 'it does not say the drawing is of what was logged');
  assert.ok(
    /not everything/i.test(EXPLAINER_UNLOGGED),
    'it no longer admits the drawing is less than what she did'
  );
  assert.ok(
    /everyday movement/i.test(EXPLAINER_UNLOGGED),
    'it no longer says that ordinary movement counts too'
  );
  assert.ok(!/incidental/i.test(EXPLAINER_UNLOGGED), 'it has been tidied into jargon');
  // IT NAMES THE SCREEN, not a verb. Ruth: "The Now flower is made from the
  // movement that was logged in the Movement log." A place she can open beats
  // a word she has to interpret, and it is the honest answer to "where does
  // this come from".
  assert.ok(/Movement log/.test(EXPLAINER_UNLOGGED), 'it does not say where the drawing comes from');
  // AND IT MUST NOT CLAIM THE WEEK COUNTS. Ruth, an hour after this shipped:
  // "nothing gets counted from Plans unless it's logged, it's merely a planning
  // tool." The code agrees - the Week writes no coverage anywhere and nothing
  // reads it for the flower. The first version said "it can live in your Week
  // and count from then on", which is the exact fault this app has spent a week
  // fixing, committed inside the sentence meant to be the honest one.
  //
  // It stays wrong after the Week gains a flower of its own: that one will show
  // what a PLAN covers. Only logging reaches this drawing.
  for (const [where, text] of [
    ['the unlogged note', EXPLAINER_UNLOGGED],
    ['the Week paragraph', EXPLAINER_WEEK],
  ]) {
    assert.ok(
      !/Week[^.]*\bcounts?\b/i.test(text),
      `${where} says the Week counts towards the flower, and it does not`
    );
  }
  return 'the Movement log named, and everyday movement still counts';
});

check('THE WEEK IS DESCRIBED AS A PLAN, NOT A RECORD', () => {
  // Ruth's own sentence, and the clearest statement of what the Week is
  // anywhere in this app: "It's the weekly plan for when all goes to plan."
  // A plan is what you intend, so nothing on it is ever owed - which is the
  // same reason the Week has no ticks.
  // SHORTENED ON 21 OCTOBER 2026 to "Your Week helps you plan a balanced week,
  // making space for movement, recovery and everything else life brings." Her
  // longer sentence - "the weekly plan for when all goes to plan" - is still
  // the clearest statement of what the Week is, and it has not been lost: it
  // lives in week-coverage.ts, where the Week's own flower is built and where
  // the rule it justifies actually bites.
  //
  // WHAT THIS PARAGRAPH HAS TO KEEP DOING is say the Week is for PLANNING. A
  // plan is what you intend, so nothing on it is ever owed, which is the same
  // reason the Week has no ticks - and a sentence that described it as a
  // record would undo that in one word.
  assert.ok(/plan/i.test(EXPLAINER_WEEK), 'the Week is no longer described as a plan');
  assert.ok(/recovery|rest/i.test(EXPLAINER_WEEK), 'it no longer makes room for rest');
  // AND IT MUST NOT READ AS A RECORD OF WHAT HAPPENED.
  for (const past of [/\blogged\b/i, /\bdid\b/i, /\bcompleted\b/i, /\bdone\b/i]) {
    assert.ok(!past.test(EXPLAINER_WEEK), `the Week paragraph says ${past}, which makes it a record`);
  }
  return 'a plan, with room for recovery';
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
  // FOUND BY WHAT IT HOLDS, NOT BY THE ORDER OF ITS PROPS. This matched
  // `<FoldSection title="..." summary={flowerLabel}` with the two attributes
  // adjacent and in that order, so adding a `ruled` prop on 20 October broke
  // it - while the fault it guards, a section named after one of its own
  // petals, was nowhere near. The flower section is the one whose summary is
  // flowerLabel; its title is whatever title it carries.
  const at = now.indexOf('summary={flowerLabel}');
  assert.ok(at > -1, 'no section summarises itself with flowerLabel - the flower section moved');
  const opening = now.slice(now.lastIndexOf('<FoldSection', at), at);
  const titleMatch = opening.match(/title="([^"]+)"/);
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

check('AND THE BAR INSIDE IT DOES NOT REPEAT THAT NAME', () => {
  // Ruth, 21 October 2026, on a screenshot of the open fold: "Fix heading".
  //
  // The rewrite the day before set the collapsible's label to the fold's own
  // title, so the screen read "What's protecting you" and then, inside it,
  // "What's protecting you" again - and with the fold open the second one is
  // the only heading on screen. A bar whose label is the name of the thing it
  // is already inside tells nobody what tapping it would do.
  //
  // A GUARD RATHER THAN A MEMORY, because the two strings live in different
  // files and nothing would ever make them disagree out loud.
  const now = fs.readFileSync('mobile/src/app/(tabs)/now/index.tsx', 'utf8');
  const at = now.indexOf('summary={flowerLabel}');
  const opening = now.slice(now.lastIndexOf('<FoldSection', at), at);
  const title = opening.match(/title="([^"]+)"/)[1];
  assert.notStrictEqual(
    EXPLAINER_TITLE.toLowerCase(),
    title.toLowerCase(),
    'the collapsible is labelled with the name of the section it sits inside'
  );
  // And it still says what it opens rather than what it is about.
  assert.ok(EXPLAINER_TITLE.length > 8, 'the label is too short to say anything');
  return `"${EXPLAINER_TITLE}" inside "${title}"`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
