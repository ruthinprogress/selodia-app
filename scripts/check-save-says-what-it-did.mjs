// DOES A SETUP SCREEN EVER REPORT A SAVE IT REFUSED TO DO?
//
//   node scripts/check-save-says-what-it-did.mjs
//
// Ruth, 4 October 2026, twice in one evening:
//
//   "From Profile, filled in 'What you already do' but nothing was populated
//   anywhere in week."
//   "How your days feel in the Body Manual is broken btw, nothing selected goes
//   anywhere or is saved."
//
// Two screens, one line, present in four:
//
//     if (!mayWrite(loadState)) return true;
//
// THE REFUSAL IS CORRECT AND MUST STAY. A screen that has not read her existing
// answers cannot write, because an empty chip row is then indistinguishable from
// "she deselected everything" - which deleted her whole week on 1 October.
//
// RETURNING `true` IS THE BUG. `true` means "carry on" to the caller, so she was
// moved to the next screen, or back to her profile, and told nothing. A refusal
// reported as a success is indistinguishable from a save that worked, which is
// precisely why it could happen over and over without either of us knowing where
// her answers went. Her feel_goals table held no rows at all - not one, not even
// an archived one.
//
// FOUND IN FOUR SCREENS: activities, days, allergies, skill. Fixing one and
// leaving three is the mistake that left "Ask about this" dead on every screen,
// so this reads all of them and will read a fifth the day it is added.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR = 'mobile/src/app/onboarding';

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

const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Every screen that guards its write on having read her answers.
const screens = readdirSync(DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ file: path.join(DIR, f), name: f.replace('.tsx', ''), src: strip(readFileSync(path.join(DIR, f), 'utf8')) }))
  .filter((s) => s.src.includes('mayWrite(loadState)'));

console.log('\n  A SAVE SAYS WHAT IT DID\n');

check('the screens that guard their write are found', () => {
  ok(screens.length >= 4, `only ${screens.length} found - has the guard been renamed?`);
  return screens.map((s) => s.name).join(', ');
});

for (const screen of screens) {
  check(`${screen.name}: the refusal does not report success`, () => {
    ok(
      !/if \(!mayWrite\(loadState\)\) return true;/.test(screen.src),
      'the refusal returns `true`, so she is moved on and told nothing - which is ' +
        'indistinguishable from a save that worked, and is how a whole table stayed empty'
    );
    ok(
      /return 'not-ready';/.test(screen.src),
      'the refusal does not name itself, so the screen cannot tell her which of ' +
        '"nothing saved" and "nothing chosen" happened'
    );
    return 'it names the refusal';
  });

  check(`${screen.name}: she is not moved on from a write that did not happen`, () => {
    ok(
      /saveOutcomeMessage\(/.test(screen.src),
      'the outcome is never turned into something she can read, so a refusal is ' +
        'still silent even though it now has a name'
    );
    ok(
      /setNotSaved\(message\);\s*return;/.test(screen.src),
      'the screen shows the message and carries on anyway, which is the original ' +
        'bug with a sentence added to it'
    );
    return 'it stops and says so';
  });

  check(`${screen.name}: a boolean cannot creep back`, () => {
    // The type is what makes this hold; this asserts the type is still on it.
    ok(
      /async function save\(\): Promise<SaveOutcome>/.test(screen.src),
      'save() is back to returning a boolean, which cannot carry the difference ' +
        'between saved, nothing-chosen and refused'
    );
    return 'typed';
  });
}

check('the message for a refusal is not written in the danger colour', () => {
  // Neither outcome is an error. One is the app declining to guess at her
  // answers; the other is her having answered nothing. Colouring them as
  // failures would teach her that using the app carefully looks like breaking it.
  for (const screen of screens) {
    const raw = readFileSync(screen.file, 'utf8');
    const at = raw.indexOf('{notSaved && !failed && (');
    ok(at > 0, `${screen.name} never renders the message`);
    const block = raw.slice(at, at + 260);
    ok(
      /themeColor="textSecondary"/.test(block),
      `${screen.name} shows a deliberate non-write as an error`
    );
  }
  return `${screens.length} screens, quiet rather than alarming`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
