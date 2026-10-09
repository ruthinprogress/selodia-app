// A PETAL SAYS WHAT BUILT IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-petal-detail.mjs
//
// Ruth, 9 October 2026: "the click though on the petals need some work as right
// now it just lists everything for each petal which makes it pointless."
//
// SHE WAS DESCRIBING THE DATA, NOT THE DESIGN. The query filters on the
// dimension's own column being greater than zero, which reads like a real
// filter and is not one: nearly every activity scores non-zero in nearly every
// dimension. Yoga is strength 25, cardio 15, flexibility 85, balance 75, bone 5
// and recovery 60, so it belongs to ALL SIX petals. So does walking. A filter
// that excludes nothing is a filter in name only, and that is measured below
// rather than asserted.
//
// AND THE NUMBER THAT WOULD HAVE EXPLAINED THE LIST WAS COMPUTED AND THROWN
// AWAY. `contribution` was read out of the row, put on the object, and never
// rendered - so an activity contributing 85 and one contributing 5 appeared in
// the same shape, sorted by date. The list genuinely said nothing about the
// dimension it was headed by.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { ACTIVITY_WEIGHTS } = await import(root + '/app/lib/activity-weights.ts');

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

const DIMS = ['strength', 'cardio', 'flexibility', 'balance', 'bone', 'recovery'];
const HOOK = readFileSync('mobile/src/hooks/use-dimension-activities.ts', 'utf8');
const VIEW = readFileSync('mobile/src/components/dimension-detail.tsx', 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n  A PETAL SAYS WHAT BUILT IT\n');

check('the premise: filtering on "greater than zero" excludes almost nothing', () => {
  // THE MEASUREMENT THAT MAKES HER COMPLAINT A BUG RATHER THAN A PREFERENCE.
  const entries = Object.entries(ACTIVITY_WEIGHTS);
  assert.ok(entries.length >= 10, `only ${entries.length} activities in the table`);
  const appearsIn = entries.map(([, w]) => DIMS.filter((d) => (w[d] ?? 0) > 0).length);
  const average = appearsIn.reduce((a, b) => a + b, 0) / appearsIn.length;
  const inFiveOrMore = appearsIn.filter((n) => n >= 5).length;
  assert.ok(
    average >= 4,
    `the average activity appears under only ${average.toFixed(1)} petals, so the premise has changed`
  );
  // Yoga specifically, which is what she had logged that morning.
  const yoga = ACTIVITY_WEIGHTS['yoga'];
  assert.ok(yoga, 'yoga has gone from the table');
  assert.strictEqual(DIMS.filter((d) => (yoga[d] ?? 0) > 0).length, 6, 'yoga no longer spans all six');
  return `average ${average.toFixed(1)} of 6 petals; ${inFiveOrMore}/${entries.length} span 5 or more; yoga spans all 6`;
});

check('and this check can fail', () => {
  // The above asserts a number is HIGH, which an empty or broken table would
  // make low rather than high - so prove the opposite shape is detectable.
  const sparse = { 'only cardio': { strength: 0, cardio: 90, flexibility: 0, balance: 0, bone: 0, recovery: 0 } };
  const n = DIMS.filter((d) => sparse['only cardio'][d] > 0).length;
  assert.strictEqual(n, 1, 'a genuinely sparse row is not measured as sparse');
  // And the real table is not sparse, which is the whole point.
  assert.ok(DIMS.filter((d) => ACTIVITY_WEIGHTS['walking'][d] > 0).length >= 5, 'walking is now sparse');
  return 'a sparse row reads as 1 of 6; walking reads as 5 or more';
});

check('the list is ordered by contribution, before date', () => {
  const code = strip(HOOK);
  const byColumn = code.indexOf(".order(column, { ascending: false })");
  const byDate = code.indexOf(".order('happened_at', { ascending: false })");
  assert.ok(byColumn > 0, 'the list is no longer ordered by what built the petal');
  assert.ok(byDate > byColumn, 'date is sorted before contribution, so the biggest is not first');
  return 'biggest first, date as the tie-break';
});

check('the contribution is shown, not just computed', () => {
  const code = strip(VIEW);
  assert.ok(/a\.contribution/.test(code), 'the contribution is still computed and discarded');
  assert.ok(/strongest/.test(code), 'there is nothing to show it as a share of');
  // Relative, because the raw weighting numbers are ours and mean nothing to
  // her. A petal is being asked "what did most of this", not "what is the
  // internal coefficient".
  assert.ok(/a\.contribution \/ strongest/.test(code), 'it is shown as a raw weight rather than a share');
  return 'shown as a share of the strongest';
});

check('nothing is hidden', () => {
  // DELIBERATE. Whether a trace contribution should be dropped from the list
  // entirely is a judgement about her flower, and it is hers. This change makes
  // the list readable without deciding that for her.
  const code = strip(HOOK);
  assert.ok(/\.gt\(column, 0\)/.test(code), 'the zero filter has gone');
  assert.ok(
    !/\.gte\(column, (?:[1-9]|[1-9][0-9])\)/.test(code),
    'a threshold was introduced, which is Ruth’s decision and not this change’s'
  );
  return 'still everything above zero, just ordered and explained';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
