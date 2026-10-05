// DOES EVERY ROW OF THE BODY MANUAL OPEN ONE QUESTION AND COME BACK?
//
//   node scripts/check-one-question.mjs
//
// Ruth, 2 October 2026, 21:02: "The Profile is not working properly. I tried to
// add to Week via profile and it dragged me through onboarding again but saved
// nothing. Twice. And ended up in Chat at the end. Twice."
//
// Every row of the Body Manual links to the setup screen that owns its question,
// with `redo=1` to say: she came from her profile, this is ONE question, send her
// back when she is done. Exactly one screen read that parameter - goals.tsx,
// which I fixed the night before because she reported it on the goals row. The
// other eleven rows ignored it, so "Change this" on her week opened question 4 of
// 7 and walked her through 5, 6 and 7 into chat.
//
// I FIXED THE INSTANCE AND NOT THE CLASS. The goals fix was a `fromManual` const
// and three `if`s inside one file. Nothing made the next screen behave the same
// way and nothing failed when it did not - and the Manual had eleven other rows
// pointing at screens I had never opened.
//
// WHY THIS CHECK HAS NO LIST IN IT. A hand-kept list of screens is the thing that
// goes stale: it is how check-all came to be, after a suite stopped running for a
// day and nobody noticed. So the routes are read out of `editRoute` in
// body-manual.tsx - the same function the app itself navigates by. Add a row to
// the Manual pointing somewhere new, and this fails by name until that screen
// handles it. There is nothing to remember to update.

import { readFileSync } from 'node:fs';

const MANUAL = 'mobile/src/components/body-manual.tsx';
const SECTIONS = 'mobile/src/lib/body-manual.ts';

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

const manual = readFileSync(MANUAL, 'utf8');

// ---- the routes, read from the function the app navigates by ---------------
const routeBlock = manual.slice(manual.indexOf('function editRoute'));
const end = routeBlock.indexOf('\n  }');
const routes = [
  ...new Set(
    [...routeBlock.slice(0, end).matchAll(/return '\/onboarding\/([a-z-]+)'/g)].map((m) => m[1])
  ),
];

console.log('\n  ONE QUESTION, AND BACK TO THE MANUAL\n');

check('the Manual still routes somewhere', () => {
  ok(routes.length >= 5, `only ${routes.length} routes found - has editRoute been rewritten?`);
  return `${routes.length} screens: ${routes.join(', ')}`;
});

check('the Manual passes redo=1 on every link', () => {
  // Without this the screens below have nothing to read, and all of them fall
  // back to behaving like a step of the chain.
  ok(
    /redo: '1'/.test(manual),
    'the Body Manual no longer tells the screen she came from the Manual'
  );
  // AND WHICH ROW, since 5 October. Ruth: "It should take you back to the open
  // drop down where it came from." Landing at the top of a closed list of
  // fourteen rows is not returning somebody to where they were, and the open row
  // is the only confirmation the save happened.
  ok(
    /\[OPEN_ROW_PARAM\]: section\.key/.test(manual),
    'the row she opened is not carried out with her, so she comes back to a closed list'
  );
  ok(
    /returningTo \? \{ \[returningTo\]: true \}/.test(manual),
    'the row she came back from is not reopened, so the key travels and does nothing'
  );
  return 'every row says where she came from, and which row it was';
});

// ---- each screen, three properties ----------------------------------------
for (const route of routes) {
  const file = `mobile/src/app/onboarding/${route}.tsx`;
  const src = readFileSync(file, 'utf8');

  check(`${route}: knows she came from her Body Manual`, () => {
    ok(
      /useOneQuestion\(\)/.test(src),
      `${file} never reads redo=1, so a row tapped on her profile opens a step of ` +
        'the seven-question chain instead of one question'
    );
    return 'reads the shared helper';
  });

  check(`${route}: Continue goes back to the Manual`, () => {
    // THE SYMPTOM SHE SAW TWICE: "ended up in Chat at the end".
    const pushes = [...src.matchAll(/router\.push\('\/onboarding\/[a-z-]+'\)/g)];
    ok(
      pushes.length === 0,
      `${file} still pushes the next setup screen directly (${pushes.length} place(s)), so ` +
        'Continue walks her onward instead of returning her to the row she tapped'
    );
    ok(/leave\('\/onboarding\//.test(src), `${file} never calls leave()`);
    return 'leave() decides, not a bare push';
  });

  check(`${route}: a row tapped on her profile is not a step of setup`, () => {
    // Advancing the stored position because she edited a row moves where the app
    // thinks she is in a flow she finished. This is what pinned her to the goals
    // screen on 1 October.
    const at = src.indexOf('advanceOnboardingStep(supabase');
    if (at < 0) return 'this screen does not record a position';
    const before = src.slice(Math.max(0, at - 200), at);
    ok(
      /if \(!fromManual\) /.test(before),
      `${file} advances the stored setup step even when she only opened one row`
    );
    return 'the stored position stays put';
  });
}

// ---- the helper is the only implementation --------------------------------
check('no screen keeps its own copy of the rule', () => {
  // goals.tsx had one, which is exactly why the other eleven rows never got it.
  const offenders = [];
  for (const route of routes) {
    const src = readFileSync(`mobile/src/app/onboarding/${route}.tsx`, 'utf8');
    if (/params\.redo === '1'/.test(src)) offenders.push(route);
  }
  ok(
    offenders.length === 0,
    `${offenders.join(', ')} re-implement the check instead of calling useOneQuestion(). ` +
      'A rule written inline in one file is a rule the next file does not get.'
  );
  return 'one implementation, in lib/one-question.ts';
});

check('the header does not call it step 4 of 7', () => {
  const header = readFileSync('mobile/src/components/onboarding-header.tsx', 'utf8');
  ok(
    /isOneQuestion\(/.test(header),
    'the header still numbers a question she opened from her profile as a step of setup'
  );
  ok(
    /progress\?\.index != null && !oneQuestion/.test(header),
    'the counter is not suppressed for a single question'
  );
  return 'one question carries no position';
});

// ---- and the Manual's own sections still line up --------------------------
check('every editable section has a route', () => {
  const sections = readFileSync(SECTIONS, 'utf8');
  const keys = [...sections.matchAll(/^    key: '([a-z_]+)',$/gm)].map((m) => m[1]);
  ok(keys.length > 0, 'no sections found - has BODY_MANUAL_SECTIONS been rewritten?');
  const missing = [];
  for (const key of keys) {
    // A section is fine without a route if it is read-only or answered inline.
    const block = sections.slice(sections.indexOf(`key: '${key}'`));
    const stop = block.indexOf('\n  },');
    const body = block.slice(0, stop);
    if (/readOnly: true/.test(body) || /inline: true/.test(body)) continue;
    if (!new RegExp(`case '${key}':`).test(manual)) missing.push(key);
  }
  ok(
    missing.length === 0,
    `${missing.join(', ')} have no case in editRoute, so "Change this" does nothing`
  );
  return `${keys.length} sections, each editable or deliberately not`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
