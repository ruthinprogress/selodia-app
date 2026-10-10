// A PLATFORM-ONLY NATIVE MODULE MUST NOT BE IMPORTED AT THE TOP OF A FILE.
//
//   node scripts/check-native-modules-load-lazily.mjs
//
// This codebase documents the same fault in FOUR places - lib/steps.ts,
// lib/step-permission.ts, lib/document-pages.ts, lib/reminder-settings.ts and
// lib/notifications.ts - and it has still been written twice.
//
// WHAT GOES WRONG. react-native-health-connect builds its module object before
// Platform.select runs, so the Android branch is evaluated on EVERY platform,
// and on the New Architecture that branch is
// TurboModuleRegistry.getEnforcing('HealthConnect'), which THROWS when the
// module is absent. @kingstinct/react-native-healthkit is a Nitro module with
// no Android side at all, so it throws the same way in the other direction.
//
// The throw happens at MODULE EVALUATION, so:
//   - it is not catchable by a try/catch around an await import();
//   - the screen that imported it is dead before any of its code runs;
//   - and an over-the-air update reaching a binary built before the package
//     was added white-screens a tab that worked a minute earlier.
//
// Both of those happened: a dead Today tab on iOS, and a white Today tab on
// Android, 23 September 2026.
//
// THE RULE. These packages are reached through a function that checks
// Platform.OS first and then require()s inside itself. Nothing else.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Packages with native code for ONE platform only. Importing one of these at
// the top of a file breaks the other platform at evaluation time.
const PLATFORM_ONLY = {
  'react-native-health-connect': 'Android only - no ios directory, no podspec',
  '@kingstinct/react-native-healthkit': 'iOS only - a Nitro module with no Android side',
  '@react-native-healthkit/core': 'iOS only - the core of the above',
};

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

function sources(dir = 'mobile/src', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push({ path: p.replace(/\\/g, '/'), src: readFileSync(p, 'utf8') });
  }
  return out;
}

/** Static ES imports of a package, ignoring `import type`, which erases at build. */
function staticallyImports(src, pkg) {
  const lines = src.split('\n');
  for (const line of lines) {
    if (!line.includes(pkg)) continue;
    const t = line.trim();
    if (!t.startsWith('import ')) continue;
    // `import type X from` and `typeof import(...)` never reach the runtime.
    if (t.startsWith('import type ')) continue;
    if (!new RegExp(`from ['"]${pkg.replace('/', '\\/')}['"]`).test(t)) continue;
    return t;
  }
  return null;
}

const files = sources();

console.log('\n  A PLATFORM-ONLY NATIVE MODULE MUST LOAD LAZILY\n');

check('no screen or library imports one at the top of the file', () => {
  const offenders = [];
  for (const f of files) {
    for (const [pkg, why] of Object.entries(PLATFORM_ONLY)) {
      const line = staticallyImports(f.src, pkg);
      if (line) offenders.push(`${f.path}: ${line}   (${why})`);
    }
  }
  ok(
    offenders.length === 0,
    'static import of a platform-only native module:\n          ' +
      offenders.join('\n          ') +
      '\n          Reach it through a function that checks Platform.OS and require()s inside itself.'
  );
  return `${files.length} files, none static`;
});

check('each one is reached through a Platform-guarded require', () => {
  // The rule is not only "do not import it" - it is "load it the documented
  // way". A file that require()s without checking the platform first has the
  // same bug wearing a different face.
  for (const f of files) {
    for (const pkg of Object.keys(PLATFORM_ONLY)) {
      if (!f.src.includes(`require('${pkg}')`)) continue;
      ok(
        /Platform\.OS !== '(ios|android)'/.test(f.src),
        `${f.path} requires ${pkg} without checking Platform.OS first`
      );
    }
  }
  return 'every require sits behind a platform check';
});

check('and this check can fail', () => {
  // Prove the detector sees a real static import, ignores a type-only one, and
  // ignores the typeof import() form these files legitimately use.
  const bad = "import HealthKit from '@kingstinct/react-native-healthkit';";
  ok(staticallyImports(bad, '@kingstinct/react-native-healthkit'), 'a real static import reads as fine');

  const typeOnly = "import type { Foo } from '@kingstinct/react-native-healthkit';";
  ok(!staticallyImports(typeOnly, '@kingstinct/react-native-healthkit'), 'an erased type import reads as a fault');

  const typeofForm = "type HealthKit = typeof import('@kingstinct/react-native-healthkit');";
  ok(!staticallyImports(typeofForm, '@kingstinct/react-native-healthkit'), 'the typeof form reads as a fault');

  // And the package list is not empty, or every assertion above is vacuous.
  ok(Object.keys(PLATFORM_ONLY).length >= 2, 'nothing is being watched');
  return 'a static import fails, a type import does not';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
