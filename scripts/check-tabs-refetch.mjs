// A TAB MOUNTS ONCE. ANYTHING IT READS HAS TO BE ASKED FOR AGAIN.
//
//   node scripts/check-tabs-refetch.mjs
//
// Ruth, 9 October 2026: "The health flower didn't automatically load from the
// movement inputs, i has to choose month then back to week."
//
// Her workaround was not a workaround. Choosing Month and coming back changes
// the range, which changes the effect's dependencies, which is the only thing
// that re-ran the query. The coverage columns were on the activity row the
// whole time; the screen simply never asked again.
//
// THE SAME FAULT WAS FIXED ON THE ME TAB ON 10 SEPTEMBER, and its own comment
// says why: "This is a TAB: it mounts once and stays mounted, so a card saved
// from Chat afterwards never appeared until the app was reloaded." That fix
// went on the screen. Nothing made it a rule, so the flower inherited the bug
// three weeks later, and this check found five more places holding it now.
//
// So the rule is written down here instead: anything under (tabs), or any hook
// they use, that reads from the database must either refetch on focus or be
// named below with the reason it does not. Neither is not available.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['mobile/src/app/(tabs)', 'mobile/src/hooks'];

// NOT YET REFETCHING, AND KNOWN (9 October 2026).
//
// Listed rather than fixed, because fixing six screens at once - unasked, at
// night, on the surfaces she looks at every day - is a worse idea than making
// them visible. Each line says what goes stale, so the decision is hers and it
// is a decision rather than a discovery.
const KNOWN_STALE = {
  'now/index.tsx':
    "the weekly roundup paragraph. Written once a week, so it goes stale slowly - but a roundup generated on Sunday will not appear until the app is restarted.",
  // log/cycle.tsx CAME OFF THIS LIST on 10 October 2026, when the screen split
  // into the history screen and log/cycle-day.tsx and both were given a focus
  // refetch. It had been named here rather than fixed, which was the right call
  // at the time and stopped being one the moment the file was being rewritten
  // anyway. The exemption was removed by this check refusing to pass with a
  // stale entry on the list - the half of it that fails when something is
  // fixed, not only when something breaks.
  'log/feeling.tsx': 'the feelings history, same.',
  'use-burn-figures.ts': 'the day burn figures behind the Now rows.',
  'use-dimension-activities.ts':
    'the list behind a Health Flower petal - which is the OTHER flower complaint she raised the same day.',
  'use-weekly-roundup.ts': 'the roundup read, shared with now/index.tsx.',
};

// Reads nothing of hers: auth state and a notification handle.
const NOT_DATA = ['use-auth-guard.ts', 'use-records-step.ts', 'use-reminder-restore.ts'];

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

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => (statSync(r).isDirectory() ? walk(r) : []));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const short = (f) => f.replace(/\\/g, '/').replace(/^mobile\/src\/app\/\(tabs\)\//, '').replace(/^mobile\/src\/hooks\//, '');

console.log('\n  A TAB MOUNTS ONCE\n');

check('the Health Flower asks again when the tab is focused', () => {
  const src = strip(readFileSync('mobile/src/hooks/use-health-flower.ts', 'utf8'));
  ok(/useFocusEffect/.test(src), 'the flower is back to reading once on mount');
  ok(/reload\(\)/.test(src), 'it focuses but does not reload');
  // In the hook, not the screen, so a second flower cannot inherit the bug.
  const section = strip(readFileSync('mobile/src/components/balance-flower-section.tsx', 'utf8'));
  ok(
    !/useFocusEffect/.test(section),
    'the refetch has moved into the screen, where the next consumer will not get it'
  );
  return 'in the hook, so every consumer gets it';
});

check('every database read under a tab either refetches or is named', () => {
  const offenders = [];
  for (const file of files) {
    const name = short(file);
    if (NOT_DATA.includes(name)) continue;
    const src = strip(readFileSync(file, 'utf8'));
    const reads = /supabase[\s\S]{0,80}?\.from\(/.test(src) || /\.from\('[a-z_]+'\)/.test(src);
    if (!reads) continue;
    if (/useFocusEffect/.test(src)) continue;
    if (name in KNOWN_STALE) continue;
    offenders.push(name);
  }
  ok(
    offenders.length === 0,
    offenders.join(', ') +
      '\n          These read her data inside a tab and never ask again, so anything ' +
      'logged afterwards\n          will not appear until the app restarts. Add a ' +
      'focus refetch, or add it to KNOWN_STALE with what goes stale.'
  );
  return `${files.length} files, ${Object.keys(KNOWN_STALE).length} named as still stale`;
});

check('and this check can fail', () => {
  // The assertion above is that a list came back empty, which is also what a
  // scan that finds nothing returns. So prove it sees reads at all, and that
  // the known-stale list is really made of files that do read and do not
  // refetch - otherwise the exemptions are hiding nothing and the check is
  // passing on an empty room.
  const withReads = files.filter((f) => {
    const src = strip(readFileSync(f, 'utf8'));
    return /\.from\('[a-z_]+'\)/.test(src);
  });
  ok(withReads.length >= 6, `only ${withReads.length} files read the database - the scan is blind`);
  for (const name of Object.keys(KNOWN_STALE)) {
    const hit = files.find((f) => short(f) === name);
    ok(hit, `KNOWN_STALE names ${name}, which does not exist`);
    const src = strip(readFileSync(hit, 'utf8'));
    ok(!/useFocusEffect/.test(src), `${name} is on the stale list but already refetches - remove it`);
  }
  return `${withReads.length} readers found, and every exemption is real`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
