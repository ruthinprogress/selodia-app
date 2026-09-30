// NOBODY CAN BE LOCKED INSIDE ONBOARDING.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-onboarding-exit.mjs
//
// 30 September 2026. Ruth tapped "redo setup" in More and could not get out.
// "LOCKED IN. Force-closing twice does not help." Two separate faults, and it
// took both to trap her:
//
//   THE DOOR LOCKED BEHIND HER. redoSetup wrote onboarding_step = 'goals' the
//   instant she tapped it, before she had answered anything. use-auth-guard
//   sends an unfinished account back into the flow, so the app became a place
//   she could not return to - and because the step is in the database,
//   force-closing read it again and put her straight back.
//
//   AND THE WAY FORWARD WAS NOT DRAWN. The Continue button lives in the
//   onboarding header, and the header returned null on any screen missing from
//   ONBOARDING_SCREENS. Seven screens were missing - the entire flow after
//   Goals - so Continue took her to a screen with no controls at all.
//
// WHAT THIS CHECKS, and none of it is a wording:
//
//   every screen the flow can push to is one the header and the guard know
//   about, with the chain read OUT OF THE SOURCE rather than from a list
//   somebody typed here, because a hand-copied list is what failed twice;
//
//   the redo entry point does not write onboarding_step;
//
//   the header does not hide its action when it cannot place the screen.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FLOW_SCREENS, progressForPath } from '../mobile/src/lib/onboarding-progress.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONBOARDING = path.join(ROOT, 'mobile', 'src', 'app', 'onboarding');
const read = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

// EVERY DESTINATION THE FLOW CAN REACH, read from the screens themselves.
function chainTargets() {
  const targets = new Map();
  for (const file of fs.readdirSync(ONBOARDING)) {
    if (!file.endsWith('.tsx') || file === '_layout.tsx') continue;
    const source = stripComments(read(path.join(ONBOARDING, file)));
    for (const m of source.matchAll(/router\.(?:push|replace)\(\s*(?:\{\s*pathname:\s*)?'\/onboarding\/([a-z-]+)'/g)) {
      targets.set(m[1], (targets.get(m[1]) ?? []).concat(file));
    }
  }
  return targets;
}

const targets = chainTargets();

check('the flow can push somewhere at all', () => {
  assert.ok(targets.size >= 5, `found only ${targets.size} destinations - the scan is wrong`);
});

// NOT A FAILURE, AND THE DISTINCTION IS THE POINT. A screen with no progress
// label loses a number. A screen with no Continue button loses the person. The
// header no longer ties the two together, so this reports the first and the
// check below fails on the second.
//
// The four it names today - health-context, technical, nutrition, activity -
// are the legacy target branch, still pushed between themselves and reachable
// only through RESUME_ROUTE. They belong to the onboarding redesign Ruth has
// queued and has said not to start yet.
{
  const entryScreens = new Set(['consent', 'account', 'reset-password']);
  const unlabelled = [...targets.keys()].filter(
    (r) => !entryScreens.has(r) && !progressForPath(`/onboarding/${r}`)
  );
  if (unlabelled.length > 0) {
    console.log(`  NOTE  no progress label (a missing count, not a missing way out): ${unlabelled.join(', ')}`);
  }
}

check('and every one is a screen the auth guard leaves alone', () => {
  const entry = new Set(['consent', 'account', 'reset-password']);
  const policed = [...targets.keys()].filter((r) => !entry.has(r) && !FLOW_SCREENS.has(r));
  assert.equal(
    policed.length,
    0,
    `the guard does not recognise ${policed.join(', ')} - a finished account opening one is thrown out, ` +
      'an unfinished one is dragged back'
  );
});

check('redoing setup does not mark the account unfinished', () => {
  const profile = stripComments(read(path.join(ROOT, 'mobile', 'src', 'app', 'settings', 'profile.tsx')));
  assert.ok(
    !/onboarding_step/.test(profile),
    'the redo entry point writes onboarding_step. That is what locked her in: from that moment ' +
      'the guard treats the account as unfinished and will not let it back into the app.'
  );
});

check('the header keeps its action on a screen it cannot place', () => {
  const header = stripComments(
    read(path.join(ROOT, 'mobile', 'src', 'components', 'onboarding-header.tsx'))
  );
  // The early return may not be reachable on `progress` alone - that is the bug.
  const bare = /if\s*\(\s*!progress\s*\)\s*return null/.test(header);
  assert.ok(
    !bare,
    'the header still returns null whenever it cannot place the screen, which takes the Continue ' +
      'button with it'
  );
  assert.ok(
    /!progress\s*&&\s*!action/.test(header),
    'the header must only render nothing when there is no action to offer either'
  );
});

check('there is a visible way out of a redo', () => {
  const header = read(path.join(ROOT, 'mobile', 'src', 'components', 'onboarding-header.tsx'));
  assert.ok(/Not now/.test(header), 'no "Not now" is drawn anywhere in the header');
  assert.ok(/useRedoing/.test(header), 'the header does not know whether this is a redo');
});

// ---------------------------------------------------------------- MUTATION
//
// Each fault put back, and each one must be caught. A check that has only ever
// passed is indistinguishable from one that does nothing.

const entry = new Set(['consent', 'account', 'reset-password']);

// 1. Drop `skill` from the screen list, which is the exact state of 30 September.
let listCaught = false;
try {
  const withoutSkill = new Set([...FLOW_SCREENS].filter((r) => r !== 'skill'));
  const policed = [...targets.keys()].filter((r) => !entry.has(r) && !withoutSkill.has(r));
  assert.equal(policed.length, 0);
} catch {
  listCaught = true;
}

// 2. Put the step write back into the redo.
let stepCaught = false;
try {
  const broken = "async function redoSetup() { await supabase.from('user_profile').update({ onboarding_step: 'goals' }); }";
  assert.ok(!/onboarding_step/.test(broken));
} catch {
  stepCaught = true;
}

// 3. Put the bare early return back into the header.
let headerCaught = false;
try {
  const broken = 'const progress = progressForPath(pathname);\n  if (!progress) return null;\n';
  assert.ok(!/if\s*\(\s*!progress\s*\)\s*return null/.test(broken));
} catch {
  headerCaught = true;
}

if (!listCaught) failures.push('USELESS: removing a screen from the flow list was not caught');
if (!stepCaught) failures.push('USELESS: putting the step write back was not caught');
if (!headerCaught) failures.push('USELESS: putting the header early-return back was not caught');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(`  Chain destinations read from source: ${[...targets.keys()].sort().join(', ')}`);
console.log(
  `  Proof: a missing screen is caught = ${listCaught}, the step write is caught = ${stepCaught}, ` +
    `the header early-return is caught = ${headerCaught}`
);
if (failures.length > 0) process.exit(1);
