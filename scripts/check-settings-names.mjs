// CHAT CALLS THE SCREENS WHAT THE SCREENS ARE CALLED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-settings-names.mjs
//
// app-structure.ts is the paragraph that tells the model what this app's screens
// are, and it is the only description of the app the model ever gets. When a row
// is renamed and that paragraph is not, the model goes on naming a screen that no
// longer exists - which is this morning's fault wearing different clothes.
//
// 7 October 2026, two hours apart:
//   09:11  "that'd need to happen in the log itself, where you can edit the date
//          on that entry directly" - a screen that was never built.
//   11:00  Ruth renames "Data and export" to "Your data" and moves "Build a
//          report" out to its own row. The paragraph still said "Data and
//          export", in a sentence telling the model that is where a report is
//          built.
//
// The first one the model invented. The second one I would have left behind, and
// it is worse, because a name that USED to be true is the kind a person goes
// looking for.
//
// SO THE NAMES ARE COMPARED, not remembered. Every settings-row name the prompt
// puts in quotes has to be a row that exists.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { APP_STRUCTURE_PROMPT_BLOCK } = await import(root + '/app/lib/app-structure.ts');

const menu = readFileSync('mobile/src/app/settings/index.tsx', 'utf8');

/** Every row label on the More menu, as the person reads them. */
function menuLabels() {
  return [...menu.matchAll(/^\s*label="([^"]+)"/gm)].map((m) => m[1]);
}

/** The SETTINGS sentence of the prompt, which is the one that names rows. */
function settingsLine() {
  const line = APP_STRUCTURE_PROMPT_BLOCK.split('\n').find((l) => l.startsWith('- SETTINGS'));
  assert.ok(line, 'the SETTINGS line has moved or been renamed in app-structure.ts');
  return line;
}

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

console.log('\n  THE SCREENS IT NAMES ARE THE SCREENS THERE ARE\n');

check('the menu really has rows to compare against', () => {
  const labels = menuLabels();
  assert.ok(labels.length >= 8, `only ${labels.length} rows found, so the scan is reading nothing`);
  assert.ok(labels.includes('Your data'), 'the Your data row was not found');
  assert.ok(labels.includes('Build a report'), 'the Build a report row was not found');
  return `${labels.length} rows: ${labels.join(', ')}`;
});

check('every row the prompt names in quotes exists', () => {
  // THE DIRECTION THAT MATTERS. A row the prompt never mentions is a row the
  // model simply does not offer. A row the prompt names that is NOT there is the
  // model sending somebody to a screen, which is the thing that cost her a
  // morning.
  const quoted = [...settingsLine().matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const labels = menuLabels();
  // "Delete my account" is a control inside Your data rather than a row of its
  // own, and the prompt says so in the same sentence. Named here so the
  // exception is stated rather than silently tolerated by a loose match.
  const insidePages = ['Delete my account'];
  const missing = quoted.filter((q) => !labels.includes(q) && !insidePages.includes(q));
  assert.deepStrictEqual(
    missing,
    [],
    `the prompt names ${missing.join(', ')}, which is not a row on the More menu - ` +
      'so the model will send somebody to a screen by a name they cannot find'
  );
  return `${quoted.length} named, all real`;
});

check('the old name is gone from the prompt as well as the app', () => {
  assert.ok(
    !/Data and export/.test(APP_STRUCTURE_PROMPT_BLOCK),
    'the prompt still calls it "Data and export", which is a name the app no longer uses'
  );
  assert.ok(
    !/Data and export/.test(menu),
    'the More menu still has a row called "Data and export"'
  );
  return 'renamed in both places';
});

check('the report is described as its own row, not inside the data page', () => {
  // Her instruction, and the reason for it: a document to take to a clinician is
  // not an exercise of a data right, and it should not be two taps inside the
  // page about deleting everything.
  const line = settingsLine();
  assert.ok(/"Build a report" is its own row/.test(line), 'the prompt does not say the report has its own row');
  const data = readFileSync('mobile/src/app/settings/data.tsx', 'utf8');
  assert.ok(
    !/settings\/report/.test(data),
    'the Your data page still links to the report, so it is in two places'
  );
  return 'one place, and the prompt agrees';
});

check('the consents are in one place, not two', () => {
  // TWO CONTROLS FOR ONE FACT is a fault this repository has had before, and a
  // consent toggle is the worst place for it: the switch she did not touch is
  // the one that decides.
  const data = readFileSync('mobile/src/app/settings/data.tsx', 'utf8');
  const privacy = readFileSync('mobile/src/app/settings/privacy.tsx', 'utf8');
  assert.ok(/<ConsentChoices \/>/.test(data), 'the consents are not on the Your data page');
  assert.ok(
    !/<ConsentChoices \/>/.test(privacy),
    'the consents are still rendered on Privacy as well, so there are two switches for one permission'
  );
  return 'on Your data only';
});

check('and this check can fail', () => {
  // replaceAll, not replace: "Your data" appears twice on that line, once
  // unquoted in the comma list and once in quotes, and replacing only the first
  // left the quoted one intact - so the fixture changed nothing and said so.
  const stale = settingsLine().replaceAll('Your data', 'Data and export');
  const quoted = [...stale.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const labels = menuLabels();
  const missing = quoted.filter((q) => !labels.includes(q) && q !== 'Delete my account');
  assert.ok(
    missing.length > 0,
    'a prompt naming a screen that does not exist is not detected, so this check tests nothing'
  );
  return `the stale name is caught: ${missing.join(', ')}`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
