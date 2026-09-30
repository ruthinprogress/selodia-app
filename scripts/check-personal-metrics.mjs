// A NAMED MEASUREMENT LANDS ONCE, WITH ITS UNIT.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-personal-metrics.mjs
//
// Ruth's item 5: "'Waist 70cm', 'calf 36cm', 'head 55cm' each land as a reading
// on the Measurements screen with the right unit, and appear under Latest and
// History."
//
// WHAT THIS DOES AND DOES NOT COVER. The extraction from free text is a model
// call and costs money, so it is not run here - see the note at the bottom for
// the command that does it, to be run when she is awake and has said yes. What
// IS covered is everything after the model: the row that gets built, which is
// where a name is reconciled, a unit is kept and a misparse is dropped.
//
// That is the half that can be wrong silently. A model returning "Waist"
// instead of "waist" would not look like a failure anywhere: the reading
// saves, the screen shows it, and her waist history is quietly in two pieces
// from that day on, each half as long. The instruction to the model has asked
// it to reuse her existing names since the day it was written; nothing
// enforced it until now.

import assert from 'node:assert';

import { personalRowsFrom } from '../app/lib/personal-metric-rows.ts';

const CTX = {
  // Exactly what her table holds, read on 29 September 2026.
  known: ['waist', 'thighs', 'calf'],
  userId: 'u1',
  measuredAt: '2026-09-29T20:24:39Z',
  rawInput: 'Waist 70cm',
};

const build = (personal, ctx = CTX) => personalRowsFrom(personal, ctx);

// HOW IT BEHAVED BEFORE: whatever the model said was stored.
const OLD = (personal, ctx = CTX) =>
  personal
    .map((m) => ({
      user_id: ctx.userId,
      measured_at: ctx.measuredAt,
      metric_name: String(m?.name ?? '').trim().slice(0, 60),
      value: typeof m?.value === 'number' && isFinite(m.value) ? m.value : null,
      value_secondary: null,
      unit: typeof m?.unit === 'string' && m.unit.trim() ? m.unit.trim().slice(0, 16) : null,
      raw_input: ctx.rawInput,
    }))
    .filter((r) => r.metric_name.length > 0 && r.value != null);

let pass = 0;
const failures = [];
const weak = [];

const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

/** Runs an assertion against both, and requires the old one to fail. */
const contrast = (name, assertion) => {
  check(name, () => assertion(build));
  let oldFailed = false;
  try {
    assertion(OLD);
  } catch {
    oldFailed = true;
  }
  if (!oldFailed) weak.push(`${name}: the old builder passed this too.`);
};

// ------------------------------------------------- her three named measurements

check('waist 70cm lands with its unit', () => {
  const [row] = build([{ name: 'waist', value: 70, unit: 'cm' }]);
  assert.equal(row.metric_name, 'waist');
  assert.equal(row.value, 70);
  assert.equal(row.unit, 'cm');
});

check('calf 36cm lands with its unit', () => {
  const [row] = build([{ name: 'calf', value: 36, unit: 'cm' }]);
  assert.equal(row.metric_name, 'calf');
  assert.equal(row.unit, 'cm');
});

check('head 55cm is accepted as a brand new metric, spelled as she said it', () => {
  const [row] = build([{ name: 'head', value: 55, unit: 'cm' }]);
  assert.equal(row.metric_name, 'head');
  assert.equal(row.value, 55);
  assert.equal(row.unit, 'cm');
});

check('two measurements in one sentence both land', () => {
  const rows = build([
    { name: 'thighs', value: 54, unit: 'cm' },
    { name: 'waist', value: 70, unit: 'cm' },
  ]);
  assert.equal(rows.length, 2);
});

// ------------------------------------------------------ the guard that was a prompt

contrast('"Waist" joins her existing waist history rather than starting a second', (impl) => {
  const [row] = impl([{ name: 'Waist', value: 70, unit: 'cm' }]);
  assert.equal(row.metric_name, 'waist');
});

contrast('"My Waist " with spaces and case is still the same metric', (impl) => {
  const [row] = impl([{ name: ' WAIST ', value: 70, unit: 'cm' }]);
  assert.equal(row.metric_name, 'waist');
});

// ---------------------------------------------------------------- misparses

check('a nameless reading is dropped rather than stored', () => {
  assert.equal(build([{ name: '   ', value: 70, unit: 'cm' }]).length, 0);
});

check('a named metric with no number is dropped', () => {
  assert.equal(build([{ name: 'waist', value: null, unit: 'cm' }]).length, 0);
});

check('no unit is null, never an invented one', () => {
  const [row] = build([{ name: 'resting heart rate', value: 58, unit: null }]);
  assert.equal(row.unit, null);
});

check('a paired reading keeps both numbers', () => {
  const [row] = build([{ name: 'blood pressure', value: 120, value_secondary: 80, unit: 'mmHg' }]);
  assert.equal(row.value, 120);
  assert.equal(row.value_secondary, 80);
});

for (const f of failures) console.error('  FAIL  ' + f);
for (const w of weak) console.error('  WEAK  ' + w);
console.log(`\n  ${pass} passed, ${failures.length} failed, ${weak.length} weak`);
console.log(
  '  NOT COVERED: the free-text extraction itself, which is a model call.\n' +
    '  To prove end to end, with her permission because it spends money:\n' +
    '    npx tsx scripts/check-measurement-parse.mjs   (not written yet - see the build log)'
);
if (failures.length + weak.length > 0) process.exit(1);
