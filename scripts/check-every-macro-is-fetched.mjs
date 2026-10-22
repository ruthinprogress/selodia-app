// A MACRO NOBODY FETCHED IS A MACRO NOBODY CAN SEE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-every-macro-is-fetched.mjs
//
// Ruth reported this twice in one day, 22 October 2026: "Iron and calcium not
// showing on food logs", and then, after the first fix, "Iron and Calcium. Not
// showing up still."
//
// BOTH TIMES THE PIPELINE WAS FINE. The parser filled calcium and iron, the
// columns held them, the chat could read them, and her setting listed them. The
// screen's query named its columns BY HAND, in a string written before either
// macro existed:
//
//   'id, happened_at, meal_label, raw_text, kcal, protein_g, carbs_g, fat_g,
//    saturated_fat_g, sugar_g, fibre_g, sodium_mg'
//
// So the rows came back without the fields, amount() read undefined, and the
// honest rule that a missing figure is left out rather than shown as zero did
// exactly what it was built to do: it hid them. Every line, every daily total,
// every weekly average, silently.
//
// THE FIX IS THAT THE LIST IS GENERATED, and this is the check that keeps it
// that way. A column list kept in step with MACROS by memory goes out of step
// the first time somebody adds one - which here took less than a day.
//
// IT IS THE SAME FAULT AS THE OTHER THREE THIS WEEK, in a fourth place:
// collected, stored, and read by nobody. The parse captured it, the column held
// it, the setting recorded that she wanted it, and one SELECT in one component
// decided she could not have it.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { MACROS, MACRO_COLUMNS } = await import(here('mobile/src/lib/tracked-macros.ts'));

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

// Every component that reads a food row to show its macros.
const READERS = [
  'mobile/src/components/food-log-view.tsx',
  'mobile/src/components/food-breakdown-card.tsx',
];

console.log('\n  EVERY MACRO IS FETCHED\n');

check('THE COLUMN LIST HOLDS EVERY MACRO THE APP OFFERS', () => {
  for (const m of MACROS) {
    assert.ok(
      MACRO_COLUMNS.includes(m.column),
      `${m.key} is offered and its column ${m.column} is never fetched`
    );
  }
  // The two that produced the bug, named so a regression says their names.
  assert.ok(MACRO_COLUMNS.includes('calcium_mg'), 'calcium is not fetched');
  assert.ok(MACRO_COLUMNS.includes('iron_mg'), 'iron is not fetched');
  return `${MACROS.length} columns`;
});

check('AND NO SCREEN TYPES ITS OWN LIST', () => {
  // The rule, not the instance. A hand-written list is correct on the day it is
  // written and wrong the next time a macro is added, and the failure is
  // silent - a figure that is simply never shown.
  for (const file of READERS) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(src.includes('MACRO_COLUMNS'), `${file} does not use the generated column list`);
    // A literal naming the macro columns in sequence is the shape that went
    // wrong; one naming a couple of them incidentally is not what this is for.
    const handWritten = /'[^']*\bkcal, protein_g\b[^']*'/.exec(src);
    assert.strictEqual(handWritten, null, `${file} still names its macro columns by hand: ${handWritten?.[0]}`);
  }
  return `${READERS.length} readers, both generated`;
});

check('AND THE GENERATED LIST IS A SELECT, NOT AN ARRAY', () => {
  // It is interpolated straight into a PostgREST select, so a comma-separated
  // string is the shape, and spaces after the commas are what the rest of the
  // codebase writes.
  assert.strictEqual(typeof MACRO_COLUMNS, 'string', 'the column list is not a string');
  assert.ok(/^[a-z_]+(, [a-z_]+)+$/.test(MACRO_COLUMNS), MACRO_COLUMNS);
  // No duplicates, which a select tolerates but which would mean two macros
  // share a column and one of them is wrong.
  const cols = MACRO_COLUMNS.split(', ');
  assert.strictEqual(new Set(cols).size, cols.length, `a column is listed twice: ${MACRO_COLUMNS}`);
  return MACRO_COLUMNS;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
