// THE GROUPS EXIST. DOES A SCREEN DRAW THEM?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-symptom-groups-are-rendered.mjs
//
// Ruth, 10 October 2026, five screenshots of the Cycle screen: "Not what we
// designed."
//
// SYMPTOM_GROUPS was written on 9 October with four groups named for what a
// symptom IS rather than who gets it, and check-symptom-vocabulary.mjs put SEVEN
// passing assertions on it: the perimenopausal entries are present, no group is
// named after an age, the flat list is derived from the groups, her own words
// still beat the chips. Every one of them passed. Every one of them tested the
// DATA, and no screen imported SYMPTOM_GROUPS at all, so what reached her phone
// was a flat wall of twenty-five chips - the exact thing the grouping existed to
// prevent.
//
// THIS IS THE THIRD TIME THAT SHAPE HAS COST A DAY:
//   - six checks on the ask-about-this button, all starting from the buttons
//     that already sent, while the one that did not was exempt from all six;
//   - check-update-reaches-phone defaulting its branch to `preview` and so only
//     ever asking whether publishing there WOULD work;
//   - and this.
// In each case the check chose a subject that could not contain the fault.
//
// So this one starts from the SCREENS and works back to the data, which is the
// direction that can find an absence.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { SYMPTOM_GROUPS, COMMON_SYMPTOMS } = await import(root + '/mobile/src/lib/cycle-day.ts');

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

/** Every screen file under the app router, as {path, source}. */
function screens(dir = 'mobile/src/app', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) screens(p, out);
    else if (e.name.endsWith('.tsx')) out.push({ path: p.replace(/\\/g, '/'), src: readFileSync(p, 'utf8') });
  }
  return out;
}

const all = screens();

console.log('\n  THE GROUPS EXIST. DOES A SCREEN DRAW THEM?\n');

check('some screen renders the symptom picker at all', () => {
  const pickers = all.filter((s) => /symptomChoices|SYMPTOM_GROUPS|COMMON_SYMPTOMS/.test(s.src));
  ok(pickers.length > 0, 'no screen offers a symptom picker anywhere');
  return pickers.map((s) => s.path.split('/').pop()).join(', ');
});

check('every screen that offers symptoms offers them in groups', () => {
  // THE ASSERTION THAT WAS MISSING. A screen reaching for the flat list where a
  // picker belongs is the 25-chip wall, whatever the library contains.
  const offenders = [];
  for (const s of all) {
    const offersPicker = /symptomChoices\(|COMMON_SYMPTOMS/.test(s.src);
    if (!offersPicker) continue;
    if (!/GroupedChips/.test(s.src)) offenders.push(s.path);
  }
  ok(
    offenders.length === 0,
    `flat symptom list on: ${offenders.join(', ')}. ` +
      'SYMPTOM_GROUPS exists and is tested; a screen drawing the flat list ignores all of it.'
  );
  return 'none render the flat list';
});

check('the day screen draws all four groups, by name', () => {
  const day = all.find((s) => s.path.endsWith('log/cycle-day.tsx'));
  ok(day, 'there is no day screen - the six cards have nowhere to live');
  ok(/GroupedChips/.test(day.src), 'the day screen does not use GroupedChips');
  ok(/groups=\{SYMPTOM_GROUPS\}/.test(day.src), 'GroupedChips is not given SYMPTOM_GROUPS');
  return SYMPTOM_GROUPS.map((g) => g.name).join(' · ');
});

check('GroupedChips actually puts a heading on each group', () => {
  // A component named for grouping that rendered one flat list would pass every
  // assertion above. So read it.
  const src = readFileSync('mobile/src/components/cycle-cards.tsx', 'utf8');
  const fn = src.slice(src.indexOf('export function GroupedChips'));
  const body = fn.slice(0, fn.indexOf('\n/** The "Add another"'));
  ok(/groups\.map\(/.test(body), 'GroupedChips does not iterate the groups');
  ok(/\{g\.name\}/.test(body), 'a group is drawn without its name');
  ok(/options=\{g\.items\}/.test(body), 'a group is drawn without its own items');
  return 'iterates, names, and draws each group separately';
});

check("her own words are not duplicated into a group's chips", () => {
  const src = readFileSync('mobile/src/components/cycle-cards.tsx', 'utf8');
  ok(
    /known\.has\(s\.toLowerCase\(\)\)/.test(src),
    'extras are not filtered against the groups, so a chip can appear twice and ' +
      'selecting one will leave the other looking unselected'
  );
  return 'extras are filtered against the group items';
});

check('and this check can fail', () => {
  // Prove the central assertion detects the real 9 October state: a screen that
  // reaches for the flat list and never mentions GroupedChips.
  const asItWas = "const options = symptomChoices(usedSymptoms);\n<Chips options={options} />";
  const offends = /symptomChoices\(|COMMON_SYMPTOMS/.test(asItWas) && !/GroupedChips/.test(asItWas);
  ok(offends, 'the flat-list fixture reads as acceptable');
  // And a grouped screen does not trip it.
  const asItIs = '<GroupedChips groups={SYMPTOM_GROUPS} extras={usedSymptoms} />';
  ok(!(/symptomChoices\(|COMMON_SYMPTOMS/.test(asItIs) && !/GroupedChips/.test(asItIs)), 'a correct screen trips it');
  // And the groups are not empty, or every assertion above is vacuous.
  ok(SYMPTOM_GROUPS.length === 4, `${SYMPTOM_GROUPS.length} groups`);
  ok(COMMON_SYMPTOMS.length >= 20, `${COMMON_SYMPTOMS.length} symptoms`);
  return 'the 9 October screen fails, the 10 October screen passes';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
