// CAN A SETUP REDO STILL TAKE SOMETHING OUT OF HER WEEK?
//
//   node scripts/check-week-write-plan.mjs
//
// On 1 October Ruth opened "redo my setup", walked to the activities screen and
// pressed Continue. Gym on Wednesdays and her French class on Thursday - added
// through chat four hours earlier - were deleted, and nothing written in their
// place. That was repaired the same evening by scoping the delete to this
// screen's own ten activities.
//
// IT WAS HALF A REPAIR. The delete still ran above the "nothing chosen" early
// return, so the no-op walk still removed every one of the ten. The French class
// survived the second version; Gym, Pilates and Dance did not. The source check
// written to catch it passed, because its assertion ended in an exception for the
// shape the file actually had.
//
// So the decision moved into `planWeekWrite`, and this runs it. Case 2 below is
// the exact state that cost her those three rows: her week full, the screen
// still loading, Continue pressed. It must plan nothing.

import assert from 'node:assert';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The module is TypeScript with no runtime types in it; strip the annotations
// rather than pull a compiler in for one file.
const SRC = 'mobile/src/lib/week-write-plan.ts';
const js = readFileSync(SRC, 'utf8')
  .replace(/^export type [\s\S]*?^};$/gm, '')
  .replace(/: WeekWritePlan \| null/g, '')
  .replace(/: boolean/g, '')
  .replace(/\(args: \{[\s\S]*?\}\)/, '(args)')
  .replace(/\.filter\(\(u\): u is \{ id: string; cadence: string \} =>/, '.filter((u) =>')
  .replace(/\(plan: WeekWritePlan\)/, '(plan)');
const dir = mkdtempSync(path.join(tmpdir(), 'weekplan-'));
const out = path.join(dir, 'plan.mjs');
writeFileSync(out, js);
const { planWeekWrite, planIsEmpty } = await import('file://' + out.replace(/\\/g, '/'));

const OWN = [
  'Walking',
  'Running',
  'Gym or weights',
  'Yoga',
  'Pilates',
  'Swimming',
  'Cycling',
  'Dance or ballet',
  'Bar work or calisthenics',
  'Classes of some kind',
];

// Her week as it stood on 1 October, before the redo took it.
const HERS = [
  { id: 'r-gym', activity: 'Gym or weights', cadence: 'A few times a week', sort_order: 0 },
  { id: 'r-pilates', activity: 'Pilates', cadence: '1x/week', sort_order: 1 },
  { id: 'r-ballet', activity: 'Dance or ballet', cadence: '1x/week', sort_order: 2 },
  // Added in chat. Not one of the ten, so not this screen's at all.
  { id: 'r-french', activity: 'French class', cadence: '1x/week', sort_order: 3 },
];

const asChosen = (rows) => rows.map((r) => ({ activity: r.activity, cadence: r.cadence }));

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

console.log('\n  WHAT A SETUP REDO PLANS FOR HER WEEK\n');

check('1. the screen has not read her week yet: it writes nothing', () => {
  const plan = planWeekWrite({ loaded: false, existing: HERS, ownLabels: OWN, chosen: [] });
  assert.strictEqual(plan, null, 'an unloaded screen produced a write plan');
  return 'refused';
});

check('2. THE BUG: week full, nothing selected, screen still loading', () => {
  // This is 1 October. The second version of the fix planned three deletes here.
  const plan = planWeekWrite({ loaded: false, existing: HERS, ownLabels: OWN, chosen: [] });
  assert.strictEqual(plan, null, 'her week was still at risk from an unloaded screen');
  return 'Gym, Pilates and Dance survive';
});

check('3. a redo she walks through without touching anything changes nothing', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: HERS,
    ownLabels: OWN,
    // Pre-filled: the three of her own that have chips, shown as she left them.
    chosen: asChosen(HERS.filter((r) => OWN.includes(r.activity))),
  });
  assert.ok(planIsEmpty(plan), `plan was not empty: ${JSON.stringify(plan)}`);
  return 'nothing removed, nothing added, nothing updated';
});

check('4. deselecting one removes exactly that one', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: HERS,
    ownLabels: OWN,
    chosen: asChosen(HERS.filter((r) => ['Gym or weights', 'Pilates'].includes(r.activity))),
  });
  assert.deepStrictEqual(plan.remove, ['r-ballet']);
  assert.deepStrictEqual(plan.insert, []);
  return 'Dance off, Gym and Pilates and French untouched';
});

check('5. the French class cannot be removed by any combination of taps', () => {
  // Every subset of the chips, including none of them.
  const own = HERS.filter((r) => OWN.includes(r.activity));
  for (let mask = 0; mask < 1 << own.length; mask += 1) {
    const chosen = asChosen(own.filter((_, i) => mask & (1 << i)));
    const plan = planWeekWrite({ loaded: true, existing: HERS, ownLabels: OWN, chosen });
    assert.ok(!plan.remove.includes('r-french'), `mask ${mask} removed the French class`);
  }
  return `${1 << own.length} selections tried, French class survives all of them`;
});

check('6. deselecting EVERY chip is a real removal', () => {
  const plan = planWeekWrite({ loaded: true, existing: HERS, ownLabels: OWN, chosen: [] });
  assert.deepStrictEqual(plan.remove.sort(), ['r-ballet', 'r-gym', 'r-pilates']);
  assert.ok(!plan.remove.includes('r-french'));
  return 'overwrites, so nothing duplicates - and still not the French class';
});

check('7. a tapped activity with a frequency becomes a row, with no day', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: [],
    ownLabels: OWN,
    chosen: [{ activity: 'Swimming', cadence: 'A few times a week' }],
  });
  assert.deepStrictEqual(plan.insert, [
    { activity: 'Swimming', cadence: 'A few times a week', sort_order: 0 },
  ]);
  assert.ok(!('days' in plan.insert[0]), 'the plan set a day setup never asked for');
  return 'activity plus cadence, no day';
});

check('8. a tapped activity with NO frequency still becomes a row', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: [],
    ownLabels: OWN,
    chosen: [{ activity: 'Yoga', cadence: null }],
  });
  assert.strictEqual(plan.insert.length, 1, 'skipping the frequency lost the activity');
  assert.strictEqual(plan.insert[0].cadence, null);
  return 'the activity is the answer; the frequency is optional';
});

check('9. a kept activity is updated, never deleted and remade', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: HERS,
    ownLabels: OWN,
    chosen: [
      { activity: 'Gym or weights', cadence: 'Most days' },
      { activity: 'Pilates', cadence: '1x/week' },
      { activity: 'Dance or ballet', cadence: '1x/week' },
    ],
  });
  assert.deepStrictEqual(plan.remove, [], 'a kept activity was deleted');
  assert.deepStrictEqual(plan.insert, [], 'a kept activity was re-inserted, losing her day');
  assert.deepStrictEqual(plan.updateCadence, [{ id: 'r-gym', cadence: 'Most days' }]);
  return 'her Wednesday and her 10am survive the frequency change';
});

check('10. an unanswered frequency does not blank one chat already knows', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: HERS,
    ownLabels: OWN,
    chosen: [{ activity: 'Gym or weights', cadence: null }],
  });
  assert.deepStrictEqual(plan.updateCadence, [], 'a blank chip overwrote a known frequency');
  return 'silence is not an answer of "none"';
});

check('11. an activity already there is not inserted twice', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: HERS,
    ownLabels: OWN,
    chosen: asChosen(HERS.filter((r) => OWN.includes(r.activity))),
  });
  assert.deepStrictEqual(plan.insert, [], 'a redo duplicated a row');
  return 'no duplicates';
});

check('12. a new row sorts after everything already there', () => {
  const plan = planWeekWrite({
    loaded: true,
    existing: HERS,
    ownLabels: OWN,
    chosen: [...asChosen(HERS.filter((r) => OWN.includes(r.activity))), { activity: 'Swimming', cadence: null }],
  });
  assert.strictEqual(plan.insert[0].sort_order, 4, 'a new row landed on top of an existing one');
  return 'appended, not interleaved';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
