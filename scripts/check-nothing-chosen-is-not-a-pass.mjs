// AN EMPTY ANSWER IS NOT A SAVED ANSWER.
//
//   node scripts/check-nothing-chosen-is-not-a-pass.mjs
//
// Ruth, 10 October 2026, having walked a brand new account end to end: "i didn;t
// skip any questions". Her user_week and user_skills had no rows at all. Both
// statements were true.
//
// skill.tsx and activities.tsx each read:
//
//     if (outcome === 'saved' || outcome === 'nothing-chosen') { leave(next) }
//
// so an empty answer was treated exactly like a successful write: straight on to
// the next screen, nothing stored, nothing said. Pressing Continue is not
// skipping, and the screen accepted it without a word.
//
// THE CONTRACT ALREADY SAID OTHERWISE, in lib/save-outcome.ts:
//
//     /** She chose nothing. Her answers are untouched, and she should be told. */
//     | 'nothing-chosen'
//
// and the sentence to tell her with was written and waiting - "Nothing was
// selected, so your week is unchanged. Tap what applies, then Continue." Only
// that one line of control flow stood between the two.
//
// days.tsx had it right all along, under the comment "SHE IS NEVER MOVED ON FROM
// A WRITE THAT DID NOT HAPPEN". So three screens shared one outcome type and one
// of them disagreed, and the one that disagreed failed silently - which is why
// it took a new account to find and why nobody could have reported it as a bug.
//
// WHAT THIS CHECKS. Not the wording. The control flow: no screen may treat
// 'nothing-chosen' as a reason to move on.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONBOARDING = path.join(ROOT, 'mobile', 'src', 'app', 'onboarding');
const SAVE_OUTCOME = path.join(ROOT, 'mobile', 'src', 'lib', 'save-outcome.ts');

const read = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const screens = fs
  .readdirSync(ONBOARDING)
  .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
  .map((f) => ({ file: f, src: stripComments(read(path.join(ONBOARDING, f))) }))
  .filter((s) => /nothing-chosen/.test(s.src));

console.log('\n  AN EMPTY ANSWER IS NOT A SAVED ANSWER\n');

check('some screen deals with an empty answer at all', () => {
  ok(screens.length > 0, 'no onboarding screen mentions nothing-chosen, so this check is vacuous');
  return screens.map((s) => s.file).join(', ');
});

check('no screen treats nothing-chosen as a reason to move on', () => {
  // The exact shape that shipped: an OR that lets an empty answer through the
  // same door as a successful write.
  const offenders = [];
  for (const s of screens) {
    // Any boolean test that puts 'saved' and 'nothing-chosen' on the same side.
    const together = /['"]saved['"]\s*\|\|[^\n]*['"]nothing-chosen['"]|['"]nothing-chosen['"]\s*\|\|[^\n]*['"]saved['"]/;
    if (together.test(s.src)) offenders.push(s.file);
  }
  ok(
    offenders.length === 0,
    `${offenders.join(', ')} treats an empty answer like a saved one. ` +
      'She presses Continue, nothing is written, and nothing tells her. ' +
      'Only \'saved\' may leave; everything else goes through saveOutcomeMessage.'
  );
  return `${screens.length} screens, none pass on empty`;
});

check('every one of them can actually say so', () => {
  // A screen that stops without a message is a dead Continue button, which is a
  // different and equally bad failure.
  for (const s of screens) {
    ok(/saveOutcomeMessage\s*\(/.test(s.src), `${s.file} stops on an empty answer with nothing to show`);
    ok(/setNotSaved\s*\(/.test(s.src), `${s.file} never displays the message it builds`);
  }
  return 'each builds and shows the line';
});

check('the contract still says she should be told', () => {
  // If this sentence is ever softened, the checks above are enforcing a rule
  // nobody holds any more, and that should be a visible decision.
  const src = read(SAVE_OUTCOME);
  ok(/she should be told/i.test(src), 'save-outcome.ts no longer says she should be told');
  ok(
    /Nothing was selected, so your \$\{what\} is unchanged/.test(src),
    'the sentence shown for an empty answer has changed or gone'
  );
  return 'the type and the sentence both still say it';
});

check('and this check can fail', () => {
  // Prove the detector sees the real shipped line and tolerates the fixed one.
  const shipped = "if (outcome === 'saved' || outcome === 'nothing-chosen') { leave(next); }";
  const fixed = "if (outcome === 'saved') { leave(next); }";
  const together = /['"]saved['"]\s*\|\|[^\n]*['"]nothing-chosen['"]|['"]nothing-chosen['"]\s*\|\|[^\n]*['"]saved['"]/;
  ok(together.test(shipped), 'the shipped line reads as acceptable');
  ok(!together.test(fixed), 'the corrected line reads as broken');
  // And the screens examined are the ones that matter.
  const names = screens.map((s) => s.file);
  for (const f of ['days.tsx', 'skill.tsx', 'activities.tsx']) {
    ok(names.includes(f), `${f} is not among the screens this check examines`);
  }
  return 'the 10 October line fails, the fix passes';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
