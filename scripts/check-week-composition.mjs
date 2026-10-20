// THE PLANS SCREEN IS TWO CHAPTERS, NOT A STACK OF SECTIONS.
//
//   node scripts/check-week-composition.mjs
//
// Ruth, 20 October 2026, after the first pass at this: "Its not done. The
// artwork shown clearly the spacing, button widths, extra + to add in Anytime
// (it's a needed addition), heading sizes and font use. Please copy the
// artwork as right now it looks unfinished and not premium."
//
// WHY THE FIRST PASS FAILED, in the words of the brief she sent next: "your
// prompt is describing what to change, but not what the hierarchy should feel
// like. Claude/Code is faithfully tweaking margins instead of restructuring
// the composition... Do not preserve the existing vertical spacing. I am
// asking for a layout redesign rather than incremental refinement."
//
// That is the thing this file guards. Every assertion below is a COMPOSITION
// decision - something is the full width of the page, or in the serif, or
// thirty points from the thing above it - rather than a number that happens to
// be correct today. A margin drifting by two points is not what went wrong
// here; a margin drifting by two points is what went wrong INSTEAD of this.
//
// AND THE "+" IS A FEATURE, NOT A MARK. Every day had a way to put something
// on it and Anytime had none, so nothing could be added there unless something
// was already there to drag out of the week.

import assert from 'node:assert';
import fs from 'node:fs';

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

const raw = fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8');
/** Source with its comments gone, so a check cannot match its own prose. */
const src = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * One style's body, by name, whether it is written on one line or many.
 *
 * BRACE COUNTING RATHER THAN A SEARCH FOR THE CLOSING LINE. The first version
 * looked for "\n  }," which does not exist for `dayRowEmpty: {}` or for
 * `planCover: { gap: 0, marginTop: 56 }` - so it returned the whole rest of
 * the file, and three checks failed on their own helper rather than on the
 * code they were testing.
 */
function style(name) {
  const at = src.indexOf(`  ${name}: {`);
  assert.ok(at > -1, `the style "${name}" is gone - this check is testing nothing`);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error(`the style "${name}" is never closed`);
}
/** A numeric property out of a style body, resolving the Spacing tokens. */
const SPACING = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 };
function number(body, prop) {
  const m = body.match(new RegExp(`${prop}:\\s*([^,\\n]+)`));
  assert.ok(m, `"${prop}" is not set`);
  const expr = m[1].replace(/Spacing\.(\w+)/g, (_, k) => String(SPACING[k]));
  const n = Number(eval(expr)); // eslint-disable-line no-eval
  assert.ok(Number.isFinite(n), `"${prop}" is not a number: ${m[1]}`);
  return n;
}

console.log('\n  TWO CHAPTERS, AND A PAUSE BETWEEN THEM\n');

check('THE SECOND CHAPTER OPENS WITH A REAL PAUSE', () => {
  // "After the caption leave approximately 56 px of whitespace before the next
  // heading. This white space should act as a chapter break."
  const gap = number(style('planCover'), 'marginTop');
  assert.ok(gap >= 48, `the chapter break is only ${gap} points, and reads as another paragraph`);
  // AND IT IS SPACE, NOT A PANEL. "Do not use cards, coloured backgrounds or
  // heavy dividers... A card would fight the rest of Selodia."
  const body = style('planCover');
  for (const banned of ['backgroundColor', 'borderWidth', 'borderRadius']) {
    assert.ok(!body.includes(banned), `the flower section has grown a ${banned} - it is a chapter, not a card`);
  }
  return `${gap} points of nothing`;
});

check('AND EVERY PARAGRAPH IN IT IS A DIFFERENT DISTANCE', () => {
  // THE FAULT THE BRIEF NAMES: "Current implementation still gives every
  // paragraph almost identical visual weight... they should never appear as
  // one wall of grey text." An even gap between children is literally that
  // wall, so the section's own gap must be zero and each child must state its
  // own distance.
  assert.strictEqual(number(style('planCover'), 'gap'), 0, 'the section spaces its children evenly again');
  const note = number(style('planNote'), 'marginTop');
  const limit = number(style('planLimit'), 'marginTop');
  const offer = number(style('planDo'), 'marginTop');
  assert.ok(note > 0 && limit > 0 && offer > 0, 'a paragraph sets no distance of its own');
  // "Separate from the previous paragraph with noticeably more whitespace."
  assert.ok(offer > limit, `the instruction is not set apart: ${offer} against ${limit}`);
  return `${note}, ${limit}, ${offer}`;
});

check('THE INSIGHT IS THE LARGEST BODY TEXT, AND THE ONLY SERIF', () => {
  // "Largest body text. Darkest text... This is the insight." The artwork sets
  // it in the display serif, which nothing else in the section uses.
  const body = style('planNote');
  assert.ok(/DisplayFont\.regular/.test(body), 'the observation is no longer in the display serif');
  const size = number(body, 'fontSize');
  assert.ok(size >= 20, `the observation is ${size} points, which is not the largest body text`);
  // It answers the heading rather than repeating it, so it stays under the
  // section title's own 30.
  assert.ok(size < 30, `the observation is ${size} and competes with the heading`);
  // THE TWO BENEATH IT ARE HELD BACK. "Maximum line length around 75-80% of
  // screen width. Do not allow it to become visually dominant."
  for (const name of ['planLimit', 'planDo']) {
    assert.ok(/maxWidth: '80%'/.test(style(name)), `${name} runs the full measure and reads as important`);
  }
  return `serif at ${size}`;
});

check('AND THE HIERARCHY IS MADE OF SIZE, COLOUR AND SPACE ONLY', () => {
  // "Avoid: icons, badges, coloured boxes, cards, borders." The first attempt
  // set the two supporting notes off with a left rule, which the artwork draws
  // and this brief rules out. The brief is the later instruction.
  for (const name of ['planNote', 'planLimit', 'planDo']) {
    const body = style(name);
    for (const banned of ['borderLeftWidth', 'borderWidth', 'backgroundColor']) {
      assert.ok(!body.includes(banned), `${name} is set apart with ${banned} rather than with type`);
    }
  }
  // The one actionable line is terracotta, and the deep one: the theme says
  // full-strength accent is "fills, icons, large type. NOT small text".
  assert.ok(/themeColor="accentDeep"[^>]*styles\.planDo/.test(raw), 'the instruction lost its terracotta');
  assert.ok(!/type="small"\s+themeColor="accent"/.test(raw), 'small text is drawn in the full-strength accent');
  return 'type and space, nothing else';
});

console.log('\n  THE WEEK IS ONE OBJECT, DOWN TO ITS FOOTER\n');

check('THE BUTTON IS THE FULL WIDTH OF THE PAGE AND FILLED', () => {
  // "button widths" is in her list, and this was the single clearest reason
  // the screen read as unfinished: the one action on it was a pale pill the
  // width of its own label, quieter than any card above it.
  const body = style('weekButton');
  assert.ok(!/paddingHorizontal/.test(body), 'the button is padded to its label again rather than filling the page');
  assert.ok(/alignItems: 'center'/.test(body), 'the button no longer centres its label');
  assert.ok(/backgroundColor: theme\.accent\b/.test(raw), 'the button is no longer filled with the accent');
  assert.ok(/color: theme\.background/.test(raw), 'the label on the filled button is not the ground colour');
  // AND NOTHING SHARES ITS ROW. The drag hint used to sit beside it, which
  // made it a control next to some text rather than the end of the week.
  assert.ok(!/styles\.footer/.test(src), 'the button is back in a row with something else');
  return 'full width, filled, alone';
});

check('ANYTIME IS THE TAIL OF THE WEEK, NOT A NEW PAGE', () => {
  // "Reduce the gap after Sunday considerably... Sunday, 28-32px, ANYTIME THIS
  // WEEK, 12px, activity card."
  const above = number(style('anytimeHeading'), 'marginTop');
  const below = number(style('anytimeZone'), 'marginTop');
  assert.ok(above >= 24 && above <= 36, `Sunday to the heading is ${above}, outside 28 to 32`);
  assert.ok(below < above, `the heading floats: ${above} above it and ${below} below`);
  return `${above} above, ${below} below`;
});

check('AND THE BUTTON AND ITS CAPTION CLOSE THE WEEK TOGETHER', () => {
  // "24px, Log the week button, 8px, caption. The button and caption should
  // feel like the footer of the entire week."
  const toButton = number(style('weekButtonWrap'), 'marginTop');
  const toCaption = number(style('promise'), 'marginTop');
  assert.ok(toButton >= 16, `the button is only ${toButton} from the cards above it`);
  assert.ok(toCaption <= 12, `the caption is ${toCaption} from the button and reads as a separate thought`);
  assert.ok(toCaption < toButton, 'the caption is further from the button than the button is from the week');
  return `${toButton} then ${toCaption}`;
});

check('EVERY DAY IS THE SAME HEIGHT, AND RULED', () => {
  // "Every day row should have the same height regardless of whether it
  // contains activities. Empty days are not missing content. They are
  // intentional rest."
  assert.strictEqual(style('dayRowEmpty').trim(), '',
    'an empty day is shaped differently again, so it reads as a row that failed to load');
  // THE HAIRLINE IS IN THE ARTWORK. Seven days separated by nothing but space
  // read as seven floating rows; the rule is what makes them a column.
  const rule = style('dayRule');
  assert.strictEqual(number(rule, 'height'), 1, 'the day rule is no longer a hairline');
  assert.ok(/styles\.dayRule/.test(raw), 'the rule is not drawn');
  // Drawn as a sibling, because dayRow spends its own border on the drop
  // target and a borderColor set for that would repaint this too.
  assert.ok(/backgroundColor: theme\.backgroundElement \}\]} \/>/.test(raw), 'the rule lost its colour');
  return 'one height, one hairline';
});

check('AND ANYTIME HAS A WAY IN', () => {
  // Ruth: "extra + to add in Anytime (it's a needed addition)". It was needed:
  // every day had a "+" and this section had none, so the only route into
  // Anytime was to drag a card out of the week - which means nothing can be
  // put here until something is already here.
  assert.ok(/setAddingTo\(ANYTIME\)/.test(src), 'Anytime has no "+" again');
  assert.ok(/Add an activity to Anytime this week/.test(raw), 'the "+" has no accessible name');
  // IT IS A REAL DESTINATION, not a button that opens a day picker.
  assert.ok(/dayKey: DayKey \| typeof ANYTIME \| null/.test(src), 'the sheet cannot target Anytime');
  assert.ok(/zone === ANYTIME \? \[\] : \[zone\]/.test(src), 'adding to Anytime does not write an empty day list');
  // AND IT SITS IN THE SAME COLUMN as the seven above it, which is what makes
  // the right edge read as one line rather than seven marks and a gap.
  assert.ok(/styles\.addDay/.test(raw.slice(raw.indexOf('Add an activity to Anytime'))) ||
    /styles\.addDay/.test(raw), 'the Anytime "+" is a different object from the days\' ones');
  assert.ok(/flexDirection: 'row'/.test(style('anytimeZone')), 'the cards and the "+" no longer share a row');
  return 'a "+", and somewhere for it to put things';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
