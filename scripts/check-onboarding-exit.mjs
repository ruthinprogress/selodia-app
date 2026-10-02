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

import {
  FLOW_SCREENS,
  ONBOARDING_SCREENS,
  progressForPath,
} from '../mobile/src/lib/onboarding-progress.ts';

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
    for (const m of source.matchAll(/(?:router\.(?:push|replace)|leave)\(\s*(?:\{\s*pathname:\s*)?'\/onboarding\/([a-z-]+)'/g)) {
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
  // THIS ASSERTED THE WORDING, NOT THE DOOR. It required the literal string
  // "Not now", which was the label on 30 September. The label is "Leave setup"
  // now and has been for days, so the check has been failing while the way out
  // worked perfectly - a check that fails on correct code gets switched off, and
  // then it is not there for the day somebody deletes the control.
  //
  // What matters is that a redo can be left: something she can press, that stops
  // the redo and takes her out of the flow. Any wording.
  const header = read(path.join(ROOT, 'mobile', 'src', 'components', 'onboarding-header.tsx'));
  assert.ok(/useRedoing/.test(header), 'the header does not know whether this is a redo');
  assert.ok(
    /redoing && \(\s*<Pressable/.test(header),
    'a redo draws no control of its own, so there is nothing to leave by'
  );
  assert.ok(
    /setRedoing\(false\)/.test(header) && /router\.replace\('\/'\)/.test(header),
    'the way out does not both end the redo and leave the flow, so it either ' +
      'strands her or drops her back into setup on the next screen'
  );
  assert.ok(
    /accessibilityLabel="Leave setup"/.test(header),
    'the way out is not reachable or describable by a screen reader'
  );
});


// ── EVERY CONFIGURATION SCREEN IS REACHABLE, AND THE CHAIN ENDS ─────────────
//
// ADDED 30 SEPTEMBER 2026, AFTER BREAKING IT. Splitting the Body Manual out of
// the main chain left `activities` - a Configuration screen that also collects
// her height - reachable from nothing at all. The flow would have run
// goals -> skill -> life-stage and quietly skipped the screen the metabolic
// estimate depends on.
//
// Nothing would have caught that. Every other check here is about the way OUT;
// NAVIGATION IS NOT ALWAYS A BARE router.push (2 October 2026).
//
// Every Body Manual row links to the screen that owns its question with redo=1,
// meaning "one question, then back to her profile". Five screens ignored it and
// walked her through the rest of the chain into chat. The fix routes them through
// `leave(next)` in lib/one-question.ts, which goes back to the Manual or on to
// `next` depending on where she came from.
//
// THIS CHECK WENT BLIND THE MOMENT THAT LANDED, and said the chain was broken
// when it was not - because it reads the chain out of the source by looking for
// `router.push('/onboarding/x')`, and there were none left. A check that reads
// code by pattern has to be told when the pattern changes, or it reports on a
// spelling rather than on the property.
// this is the first one about the way THROUGH. It walks the pushes the screens
// actually make, from the first screen a signed-in person sees, and asserts
// that the walk arrives at the last one without stranding a Configuration
// screen nobody can get to.

check('the configuration chain runs from the first question to the first draft', () => {
  const nextOf = (route) => {
    const file = path.join(ONBOARDING, route + '.tsx');
    if (!fs.existsSync(file)) return [];
    const source = stripComments(read(file));
    return [
      ...new Set(
        [...source.matchAll(/(?:router\.(?:push|replace)|leave)\(\s*(?:\{\s*pathname:\s*)?'\/onboarding\/([a-z-]+)'/g)].map(
          (m) => m[1]
        )
      ),
    ];
  };

  const configuration = new Set(
    ONBOARDING_SCREENS.filter((s) => s.kind === 'configuration').map((s) => s.route)
  );
  // Reached before a session exists, so not part of the signed-in walk.
  for (const entry of ['consent', 'account']) configuration.delete(entry);

  const seen = new Set();
  // THE FLOW OPENS ON QUESTION 1 (2 October 2026). It used to open on `intro`,
  // a screen that asked nothing and changed nothing, which Ruth's own rule for
  // setup forbids. The entry is read from onboarding-step.ts rather than named
  // here, so moving the first question again cannot leave this check describing
  // a chain nobody walks.
  const firstMatch = read(path.join(ROOT, 'mobile', 'src', 'lib', 'onboarding-step.ts')).match(
    /const FIRST: Href = '\/onboarding\/([a-z-]+)'/
  );
  assert.ok(firstMatch, 'onboarding-step.ts no longer declares which screen the flow opens on');
  const queue = [firstMatch[1]];
  while (queue.length > 0) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    for (const next of nextOf(route)) {
      if (configuration.has(next) && !seen.has(next)) queue.push(next);
    }
  }

  const stranded = [...configuration].filter((r) => !seen.has(r));
  assert.equal(
    stranded.length,
    0,
    'these configuration screens cannot be reached by walking the chain from the first question: ' +
      stranded.join(', ') +
      ' - which is what splitting the Body Manual out did to `activities`, the screen the ' +
      'metabolic estimate needs'
  );
  assert.ok(seen.has('first-draft'), 'the chain never arrives at the first draft');
});

check('and the Body Manual is entered from the draft, not wired into the chain', () => {
  // `life-stage` UNTIL 2 OCTOBER, when it became question 6 of the seven and so
  // stopped being the Manual's entrance. The Manual chain now starts at
  // health-context. Asserted on the SET of Manual screens rather than one name,
  // so the next reshuffle fails here rather than silently stranding them.
  const draft = stripComments(read(path.join(ONBOARDING, 'first-draft.tsx')));
  const MANUAL = ['health-context', 'technical', 'nutrition', 'activity'];
  const offered = MANUAL.filter((r) => draft.includes(`/onboarding/${r}`));
  assert.ok(
    offered.length > 0,
    'the first draft offers none of the Body Manual screens, so nothing reaches them at all: ' +
      MANUAL.join(', ')
  );
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
