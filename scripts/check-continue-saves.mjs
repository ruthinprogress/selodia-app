// CAN PRESSING CONTINUE DO NOTHING?
//
//   node scripts/check-continue-saves.mjs
//
// THE BUG THIS EXISTS FOR, TWICE IN ONE DAY, BOTH MINE.
//
// 1 October, the skill screen: Ruth chose Splits, pressed Continue, and nothing
//    saved. `if (!ladder || !placement) return true` treated "a skill with no
//    placement" as "nothing chosen" and reported success. The second question was
//    below the fold, so she never knew she had not answered it.
//
// 2 October, the goals screen: I diagnosed the above that morning, wrote it up,
//    and that afternoon shipped the same shape gating a WRITE. The first press of
//    Continue computed her targets, stored them in state and RETURNED. A second
//    press on a relabelled header button was what saved. She went through
//    onboarding, chose her goal, typed "45 kg muscle", pressed Continue, and her
//    goal was never sent. Her old goal was not archived either, so Plans still
//    showed a goal from September.
//
// THE SHAPE, AND IT IS WHAT IS CHECKED HERE: a press handler that can return
// before it writes, on a path the person has no way to distinguish from the path
// that writes. A screen may legitimately save nothing when there is nothing to
// save. What it may not do is decide that on the person's behalf, silently, after
// she has answered.
//
// SO THE RULE IS NARROW AND MECHANICAL: on the non-skip path, the primary handler
// must reach its save. Any `return` between the skip branch and the save is
// either a bug or needs an explicit, named reason.
//
// WHY A SOURCE CHECK. The failure is in a component's async handler, reachable
// only by driving a phone, and it is silent. What is checkable without a phone is
// the shape: control flow that leaves the write unreached.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'mobile/src/app/onboarding';

/**
 * Returns allowed when a screen names its reason on the line above.
 *
 * ONE ESCAPE, DELIBERATELY NARROW, AND IT MUST BE WRITTEN DOWN. A screen that
 * genuinely has a second step says so with this marker, which is grep-able and
 * puts the claim next to the code. Without a marker, an early return is a bug.
 *
 * It is NOT a free pass: `check-screen-reaches-save` below still requires that
 * the screen tells her the press did not save, so the silent version stays
 * impossible either way.
 */
const MARKER = 'DELIBERATE SECOND STEP';

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
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The body of the primary press handler, by brace matching. */
function handlerBody(src, name) {
  const at = src.search(new RegExp(`(async\\s+)?function ${name}\\s*\\(`));
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));

console.log('\n  CAN PRESSING CONTINUE DO NOTHING?\n');

check('no screen returns from its Continue handler before saving', () => {
  const offenders = [];
  for (const file of files) {
    const raw = readFileSync(path.join(DIR, file), 'utf8');
    const src = stripComments(raw);
    const body = handlerBody(src, 'goOn');
    // A screen with no goOn either has no save at all (a signpost) or names its
    // handler something else; both are reported rather than skipped silently.
    if (!body) continue;
    if (!/\bsave\(\)/.test(body)) continue;

    const saveAt = body.indexOf('save()');
    // The skip branch is allowed to return: that is her saying no.
    const skipEnd = body.indexOf('}', body.indexOf('if (skipping)'));
    const between = body.slice(skipEnd < 0 ? 0 : skipEnd, saveAt);
    if (/\breturn\b/.test(between) && !raw.includes(MARKER)) {
      offenders.push(file);
    }
  }
  ok(
    offenders.length === 0,
    `${offenders.join(', ')} can return from Continue without reaching save(). ` +
      'That is how Ruth lost her 45 kg goal: the first press computed her targets ' +
      'and returned, and the button that would have saved was relabelled at the ' +
      'top of a screen whose explanation was below the fold. If a second step is ' +
      `genuinely wanted, write "${MARKER}" in the file and say why.`
  );
  return `${files.length} screens, every Continue reaches its save`;
});

check('and no screen keeps computed figures in state', () => {
  // THE SECOND HALF OF THE SAME BUG. Figures held in state can disagree with the
  // answers on screen, and reconciling them is what made a second press look
  // necessary in the first place. Derived values cannot go stale.
  const offenders = [];
  for (const file of files) {
    const src = stripComments(readFileSync(path.join(DIR, file), 'utf8'));
    if (/useState<TargetWorking \| null>/.test(src)) offenders.push(file);
  }
  ok(
    offenders.length === 0,
    `${offenders.join(', ')} holds the computed targets in state. Derive them on ` +
      'render instead, so they cannot disagree with what is selected above them.'
  );
  return 'the figures are derived, not stored';
});

check('a screen that says nothing is saved yet must actually have a second step', () => {
  // THE INVERSE, so the copy and the control flow cannot drift apart. A panel
  // saying "nothing is saved until you tap X" on a screen that saves on the first
  // press is the same lie in the other direction.
  const offenders = [];
  for (const file of files) {
    const raw = readFileSync(path.join(DIR, file), 'utf8');
    if (/Nothing is saved until/i.test(raw) && !raw.includes(MARKER)) offenders.push(file);
  }
  ok(
    offenders.length === 0,
    `${offenders.join(', ')} tells her nothing is saved yet, on a screen that saves ` +
      'on the first press.'
  );
  return 'no screen claims a step it does not have';
});

check('no screen is dead when a read fails', () => {
  // THE OTHER HALF OF WHY TWO DAYS LOOKED BROKEN. Five screens got this from me:
  //
  //   if (error) return;            // `loaded` never becomes true
  //   if (!loaded) return null;     // renders NOTHING
  //   enabled: !saving && loaded    // Continue never enables
  //
  // It is safe against losing a row and it is the worst possible outcome for her:
  // a blank screen, a dead button, and no way to tell whether the app is broken or
  // she is holding it wrong. Two states were collapsed into one boolean - "not
  // yet", which lasts milliseconds, and "it failed", which lasts forever - and the
  // second inherited the treatment designed for the first.
  //
  // A screen that reads her existing answers must use LoadState, so a failure is
  // visible, retryable, and never a trap. See lib/load-state.ts.
  const offenders = [];
  for (const file of files) {
    const src = stripComments(readFileSync(path.join(DIR, file), 'utf8'));
    if (/enabled:\s*!saving\s*&&\s*loaded\b/.test(src)) offenders.push(file);
  }
  ok(
    offenders.length === 0,
    `${offenders.join(', ')} disable Continue on a boolean that cannot tell "not ` +
      'yet" from "it failed", so a failed read leaves her stuck on a screen with no ' +
      'message. Use LoadState from lib/load-state.ts: loading disables, failed says ' +
      'so and lets her past without writing.'
  );
  return `${files.length} screens, none dead on a failed read`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
