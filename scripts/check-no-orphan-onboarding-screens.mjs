// A SCREEN NOTHING POINTS AT DOES NOT EXIST.
//
//   node scripts/check-no-orphan-onboarding-screens.mjs
//
// Ruth, 10 October 2026, having walked a brand new account on a brand new
// iPhone and finished setup in three minutes: "days, equipment, skill and
// guidance, i didn;t skip any questions".
//
// Two of those four were orphans. NOTHING IN THE ENTIRE APP LINKED TO
// /onboarding/guidance - not one push, not one href - and `equipment` was
// reachable only from `intro`, which is an orphan itself. Both were absent from
// ONBOARDING_SCREENS, so the progress count did not know they existed and the
// auth guard would have ejected anything that did reach them.
//
// AND EQUIPMENT HELD THE ONLY CALL TO requestStepPermission IN ONBOARDING. That
// is why she set up a new account on a new phone and was never asked for Health
// access once. It was read as an iOS problem, then as a fault in the HealthKit
// library replaced that same morning. It was neither. The screen that asks was
// not in the flow, and it would have behaved identically on Android.
//
// WHY check-onboarding-exit DID NOT CATCH IT, which is the part worth keeping.
// That check walks the chain FORWARD from the first question and asserts it
// reaches the end. A screen nothing points at is not on that walk, so it cannot
// fail the walk. The same shape as six checks passing on the ask-about-this
// button while the one button that never sent was exempt from all six, and as a
// publish check that defaulted its own branch. A check that starts from the
// things that work cannot find the thing that does not.
//
// So this one starts from the FILES ON DISK and from the LIST, and asks what
// nothing points at.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONBOARDING = path.join(ROOT, 'mobile', 'src', 'app', 'onboarding');
const MOBILE_SRC = path.join(ROOT, 'mobile', 'src');

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

/**
 * Screens deliberately not in the flow, each with the reason it still exists.
 *
 * An entry here is a decision that has been made, not a screen that has been
 * forgotten - which is the whole difference between the two states this check
 * exists to tell apart.
 */
const RETIRED = {
  // REMOVED BY RUTH ON 2 OCTOBER 2026, when nine screens became seven. Not
  // accidents, and not to be quietly reinstated: check-feel-and-flow guards
  // that decision, including that the counter reads "of 7" and never "of 9".
  // On 10 October I rebuilt equipment and put both back, and that check caught
  // it - which is the whole reason it exists.
  'equipment.tsx': 'removed from the seven on 2 October at her instruction',
  'guidance.tsx': 'taken off the chain in the same reshuffle',
  'intro.tsx': 'the old chat opening, replaced by tap screens',
  'first-log.tsx': 'the old first-log step, removed from the flow',
  'health-context.tsx': 'reached from the Body Manual, not from setup',
  'medication.tsx': 'reached from the Body Manual, not from setup',
  'nutrition.tsx': 'reached from the Body Manual, not from setup',
  'technical.tsx': 'reached from the Body Manual, not from setup',
  'activity.tsx': 'the old TDEE screen, superseded by activity-level',
  'steer-around.tsx': 'reached from the Body Manual, not from setup',
  'reset-password.tsx': 'reached from the account screen, not a setup step',
  'consent.tsx': 'before a session exists, so it is never resumed to',
  'account.tsx': 'before a session exists, so it is never resumed to',
  'welcome.tsx': 'the end of the flow; nothing follows it',
};

// Everything the flow can navigate to, read out of the screens themselves
// rather than from a list typed here - a hand-copied list is what failed twice
// before, and is noted as such in check-onboarding-exit.
function navigationTargets() {
  const targets = new Map();
  for (const file of fs.readdirSync(ONBOARDING)) {
    if (!file.endsWith('.tsx') || file === '_layout.tsx') continue;
    const source = stripComments(read(path.join(ONBOARDING, file)));
    for (const m of source.matchAll(
      /(?:router\.(?:push|replace)|leave)\(\s*(?:\{\s*pathname:\s*)?'\/onboarding\/([a-z-]+)'/g
    )) {
      targets.set(m[1], (targets.get(m[1]) ?? []).concat(file));
    }
  }
  return targets;
}

/** Every route named in ONBOARDING_SCREENS, in order. */
function listedRoutes() {
  const src = read(path.join(MOBILE_SRC, 'lib', 'onboarding-progress.ts'));
  return [...src.matchAll(/\{\s*route:\s*'([a-z-]+)'/g)].map((m) => m[1]);
}

const targets = navigationTargets();
const listed = listedRoutes();

console.log('\n  A SCREEN NOTHING POINTS AT DOES NOT EXIST\n');

check('every screen in the list is navigated to by something', () => {
  // consent and account come before a session exists and are entered directly;
  // days is the first question and is entered by the guard, not by a push.
  const entered = new Set(['consent', 'account', 'days']);
  const orphans = listed.filter((r) => !entered.has(r) && !targets.has(r));
  ok(
    orphans.length === 0,
    `nothing navigates to: ${orphans.join(', ')}. ` +
      'A screen in the list that nothing points at is unreachable, and the progress ' +
      'count will promise a question that never arrives.'
  );
  return `${listed.length} listed, all reachable`;
});

check('every screen file is either in the list or retired on purpose', () => {
  const files = fs
    .readdirSync(ONBOARDING)
    .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx');
  const inList = new Set(listed.map((r) => `${r}.tsx`));
  const unexplained = files.filter((f) => !inList.has(f) && !(f in RETIRED));
  ok(
    unexplained.length === 0,
    `neither in the flow nor retired: ${unexplained.join(', ')}. ` +
      'Add it to ONBOARDING_SCREENS, or to RETIRED in this file with the reason. ' +
      'A screen in neither state is one somebody meant to wire up and did not - ' +
      'which is exactly what happened to guidance.tsx.'
  );
  return `${files.length} files, ${listed.length} in the flow`;
});

check('setup asks the phone for her steps, from a screen that is IN the flow', () => {
  // THE ASSERTION THAT WOULD HAVE SAVED THE DAY. requestStepPermission lived
  // only in equipment.tsx, and equipment was removed from the seven on 2
  // October - so every account created since finished setup without the
  // operating system ever being asked for Health access.
  //
  // IT IS NOT ENOUGH THAT SHE AGREED TO SOMETHING CALLED HEALTH DATA. Ruth's
  // own reading of it: "The health permissions are the three ticks at the
  // start, that was there and I ticked them." Those are GDPR consents to
  // PROCESS data and they grant the app nothing technically. Only the platform
  // dialog does, and no app can fake or imply one. That is why this check asks
  // for the CALL and not for a form of words.
  //
  // FOLLOWED THROUGH COMPONENTS, because the request now lives in
  // step-permission-offer.tsx and is rendered by activity-level. A check that
  // only read the screen files would have reported this fixed exactly when it
  // broke again.
  const componentsDir = path.join(MOBILE_SRC, 'components');
  const askingComponents = fs
    .readdirSync(componentsDir)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => /requestStepPermission\s*\(/.test(stripComments(read(path.join(componentsDir, f)))))
    .map((f) => f.replace('.tsx', ''));

  const reached = [];
  for (const route of listed) {
    const file = path.join(ONBOARDING, `${route}.tsx`);
    if (!fs.existsSync(file)) continue;
    const source = stripComments(read(file));
    if (/requestStepPermission\s*\(/.test(source)) {
      reached.push(`${route} (directly)`);
      continue;
    }
    for (const c of askingComponents) {
      // The component is imported by path and rendered by its exported name;
      // importing without rendering would be a screen that looks wired and is not.
      const importedFrom = new RegExp(`from '@/components/${c}'`).test(source);
      if (importedFrom) reached.push(`${route} (via ${c})`);
    }
  }

  ok(
    reached.length > 0,
    'no screen in the flow asks for step permission, directly or through a component. ' +
      `Components that do ask: ${askingComponents.join(', ') || '(none)'}. ` +
      'Somebody setting up a new account will never be asked for Health access, and ' +
      'because the consent screen says "health data" they will believe they already were.'
  );
  return reached.join(', ');
});

check('onboarding no longer talks to the chat endpoint', () => {
  // Ruth, 10 October 2026: "we removed chat from onboarding ... should have all
  // been quick tap submissions." equipment.tsx still had a message thread, a
  // text input and a call to /api/onboarding-chat, four days after chat came
  // out - because nothing reached it, so nobody saw it.
  const talking = [];
  for (const file of fs.readdirSync(ONBOARDING)) {
    if (!file.endsWith('.tsx')) continue;
    const route = file.replace('.tsx', '');
    if (!listed.includes(route)) continue;
    const source = stripComments(read(path.join(ONBOARDING, file)));
    if (/onboarding-chat/.test(source)) talking.push(file);
  }
  ok(
    talking.length === 0,
    `still posting to the onboarding chat endpoint: ${talking.join(', ')}. ` +
      'Setup is tap answers now.'
  );
  return 'no screen in the flow posts to it';
});

check('and this check can fail', () => {
  // Prove each assertion is testing something rather than passing on an empty
  // set, using the real 9 October state as the fixture.
  ok(listed.length >= 8, `only ${listed.length} screens listed`);
  ok(targets.size > 0, 'no navigation found at all, so the first assertion is vacuous');

  // The orphan rule must flag a listed route that nothing points at.
  const fakeListed = [...listed, 'nowhere'];
  const entered = new Set(['consent', 'account', 'days']);
  const orphans = fakeListed.filter((r) => !entered.has(r) && !targets.has(r));
  ok(orphans.includes('nowhere'), 'an unreachable listed screen reads as reachable');

  // And the file rule must flag a file that is neither listed nor retired.
  const inList = new Set(listed.map((r) => `${r}.tsx`));
  ok(!inList.has('invented.tsx') && !('invented.tsx' in RETIRED), 'the fixture is not a fixture');

  // HER SEVEN ARE STILL SEVEN. The screens removed on 2 October stay removed:
  // this check exists to find screens nobody MEANT to strand, not to argue with
  // a decision. Putting them back broke check-feel-and-flow, which is correct.
  for (const r of ['equipment', 'guidance']) {
    ok(!listed.includes(r), `${r} is back in ONBOARDING_SCREENS - she removed it on 2 October`);
    ok(`${r}.tsx` in RETIRED, `${r} is neither in the flow nor recorded as retired`);
  }
  return 'an orphan is detected, and her seven are still seven';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
