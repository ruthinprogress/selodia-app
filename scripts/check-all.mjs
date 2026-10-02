// EVERY SOURCE-LEVEL CHECK, RUN THE WAY IT NEEDS TO BE RUN.
//
//   node scripts/check-all.mjs
//
// WHY THIS EXISTS. `check-week-add.mjs` had 28 passing cases on 1 October and by
// the following morning it died on startup - `pending-save.ts` had gained an
// extensionless import of `./almanac`, which Node's resolver will not follow.
// Nothing in the app was wrong. The check had simply stopped running, silently,
// and nobody runs twenty scripts by hand often enough to notice which of them
// printed nothing.
//
// A CHECK THAT CANNOT RUN CANNOT FAIL. In a report it is indistinguishable from
// a check that passed, which is worse than not having it: it is evidence of
// something nobody verified. So this runs all of them, states a result for each,
// and treats "crashed" as a failure in its own category rather than as silence.
//
// Every check runs with `--import ./scripts/ts-resolve-hook.mjs`, which is inert
// unless something actually needs extensionless TypeScript resolution, so a new
// check needs no registration here.
//
// THE RESULT COMES FROM THE EXIT CODE, not from parsing output. The first version
// of this script looked for the line "N passed, M failed" and reported everything
// else as crashed - which libelled a third of the suite, because several of these
// scripts print their own tally in their own words. Reading a convention that was
// never agreed is how you get a report full of confident wrong answers. Exit zero
// means the check passed; a non-zero exit with a Node error on stderr means it
// never ran; any other non-zero exit is a genuine failure.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DIR = 'scripts';
const SELF = 'check-all.mjs';

const checks = readdirSync(DIR)
  .filter((f) => f.startsWith('check-') && f.endsWith('.mjs') && f !== SELF)
  .sort();

// A probe talks to production and costs money; a check reads source or runs pure
// functions. Only checks belong in a run-everything script.
const results = [];

function firstError(out) {
  const line = out
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^(\w*Error\b|\w*Error:|node:internal)/.test(l));
  return line ? line.slice(0, 150) : 'exited non-zero with no error line';
}

/** A one-line summary of what the check said, in whatever words it used. */
function summarise(out) {
  const tally = out.match(/(\d+) passed, (\d+) failed(?:, (\d+) useless)?/);
  if (tally) return tally[0];
  // Its own closing line: the last non-empty line that is not a per-check "ok"
  // and not one of Node's own warnings, which otherwise win this by being last.
  const lines = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\(node:|^Warning:|^Reparsing|^To eliminate|^\(Use `node|^MODULE_TYPELESS/.test(l));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!/^(ok|PASS|FAIL|pass|fail)\b/.test(lines[i])) return lines[i].slice(0, 90);
  }
  return 'no output';
}

for (const file of checks) {
  const run = spawnSync(
    process.execPath,
    ['--import', './scripts/ts-resolve-hook.mjs', path.join(DIR, file)],
    { encoding: 'utf8' }
  );
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const crashed = run.status !== 0 && /^(\w*Error\b|\w*Error:)/m.test(out.replace(/^\s+/gm, ''));

  if (run.status === 0) results.push({ file, state: 'passed', note: summarise(out) });
  else if (crashed) results.push({ file, state: 'crashed', note: firstError(out) });
  else results.push({ file, state: 'failed', note: summarise(out) });
}

const width = Math.max(...results.map((r) => r.file.length));
console.log('\n  ALL SOURCE CHECKS\n');
for (const r of results) {
  const mark = r.state === 'passed' ? 'PASS   ' : r.state === 'failed' ? 'FAIL   ' : 'CRASHED';
  console.log(`  ${mark}  ${r.file.padEnd(width)}  ${r.note}`);
}

const bad = results.filter((r) => r.state !== 'passed');
console.log(
  `\n  ${results.length - bad.length}/${results.length} suites clean` +
    (bad.length > 0 ? `, ${bad.length} not: ${bad.map((b) => b.file).join(', ')}` : '') +
    '\n'
);
if (bad.length > 0) process.exit(1);
