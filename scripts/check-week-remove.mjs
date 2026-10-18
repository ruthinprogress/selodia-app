// TAKING A CARD OUT OF A DAY IS NOT TAKING IT OUT OF EVERY DAY.
//
//   node scripts/check-week-remove.mjs
//
// Ruth, 18 October 2026, within an hour of the previous fix shipping:
//
//   "I duplicated ballet and then selected 'remove from week' and it deleted
//    both."
//
// One card on Monday and Thursday is ONE ROW with two days. So there were two
// faults stacked on each other and fixing the first left the second standing:
//
//   1. the control called removeFromWeek, a hard delete       (fixed earlier)
//   2. the replacement cleared the whole `days` array, so it still came off
//      every day at once, which from the week looks the same as a delete
//
// Both were a label that was wider than the act it named, and neither could be
// caught by reading the handler, because the handler did exactly what it said.
// What was missing was the day she tapped it on.
//
// These are string checks on the source rather than behaviour tests, because
// the arithmetic here is one `filter` and the risk is not that it computes
// wrongly - it is that a later edit quietly reaches for the wider act again.

import assert from 'node:assert';
import fs from 'node:fs';

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

const plans = fs.readFileSync('mobile/src/app/(tabs)/plans.tsx', 'utf8');
const sheet = fs.readFileSync('mobile/src/components/log-plan-sheet.tsx', 'utf8');
const week = fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8');

console.log('\n  OUT OF A DAY, NOT OUT OF EVERY DAY\n');

check('THE DAYS ARRAY IS NEVER CLEARED WHOLESALE BY THE REMOVE', () => {
  // THE EXACT SHAPE OF THE BUG SHE FOUND. moveToDays(id, []) is correct for the
  // Anytime button in the move sheet, which is a deliberate "no days at all" -
  // but inside the remove handler it means "off every day", which is the
  // over-reach. So it is banned HERE and nowhere else.
  const at = plans.indexOf('onRemove={() => {');
  assert.ok(at > -1, 'the remove handler is no longer recognisable');
  // To the end of that handler: the next sibling prop at the same indent.
  const body = plans.slice(at, plans.indexOf('\n            on', at + 20));
  assert.ok(
    !/moveToDays\(\s*plan\.id\s*,\s*\[\s*\]\s*\)/.test(body),
    'the remove handler clears every day again, which is what deleted both'
  );
  assert.ok(
    /plan\.days\.filter\(/.test(body),
    'the remove handler no longer narrows to the day it was tapped on'
  );
  assert.ok(
    /d\s*!==\s*plan\.fromDay/.test(body),
    'the filter no longer removes the day she actually tapped'
  );
  return 'filters fromDay out, never empties the array';
});

check('an Anytime card is the delete, and a day card never is', () => {
  // The only deletion route that exists. If this ever fires for a card that is
  // on a day, the original fault is back in a new disguise.
  const at = plans.indexOf('onRemove={() => {');
  const body = plans.slice(at, plans.indexOf('\n            on', at + 20));
  assert.ok(/removeFromWeek\(plan\.id\)/.test(body), 'there is no delete route at all now');
  const guard = body.indexOf('if (plan.fromDay)');
  const del = body.indexOf('removeFromWeek(plan.id)');
  assert.ok(guard > -1, 'the delete is no longer behind a check for a day');
  assert.ok(del > guard, 'the delete runs before the day is checked, so it can hit a day card');
  return 'behind the else of if (plan.fromDay)';
});

check('THE LABEL SAYS WHICH DAY, OR SAYS DELETE', () => {
  // The whole class of fault here is a label wider than the act. Three acts
  // share this control and each one has to name itself.
  assert.ok(/Take out of \$\{DAY_LABEL\[plan\.fromDay\]\}/.test(sheet), 'the day is not named');
  assert.ok(/`Delete \$\{plan\.activity\}`/.test(sheet), 'the Anytime case does not say delete');
  assert.ok(
    /'Take out of my week'/.test(sheet),
    'the last-day case no longer says it leaves the week'
  );
  // And the quiet one: a plain "Take out of my week" must NOT be what a card
  // sitting on two days offers, because that is the sentence that lied.
  assert.ok(/onLastDay/.test(sheet), 'nothing distinguishes the last day from one of several');
  return 'three acts, three labels';
});

check('the sheet is told the day at BOTH places it can be opened', () => {
  // Two call sites, and the one that is easy to forget is Anytime - where the
  // answer is null, which is exactly what you get by forgetting.
  const sites = week.match(/onLogPlan\?\.\(\{/g) ?? [];
  assert.strictEqual(sites.length, 2, `expected 2 call sites, found ${sites.length}`);
  assert.ok(/fromDay: key,/.test(week), 'the day card does not pass its day');
  assert.ok(/fromDay: null,/.test(week), 'the Anytime card does not pass null');
  const withDay = week.match(/fromDay:/g) ?? [];
  assert.strictEqual(withDay.length, 2, 'a call site opens the sheet without saying where from');
  return 'day card passes key, Anytime passes null';
});

check('AND fromDay CANNOT BE FORGOTTEN BY A FUTURE CALL SITE', () => {
  // The reason it could be forgotten once: week-view declared its own copy of
  // PlanToLog's fields, so the sheet could gain a required field and the copy
  // stay valid. Required, and imported rather than restated, makes a third
  // call site that omits it fail to compile instead of behaving wrongly.
  assert.ok(
    /fromDay: DayKey \| null;/.test(sheet),
    'fromDay is optional or gone, so omitting it compiles'
  );
  assert.ok(
    /onLogPlan\?: \(plan: PlanToLog\) => void;/.test(week),
    'week-view restates the sheet type again instead of importing it'
  );
  assert.ok(
    /import \{ type PlanToLog \} from '@\/components\/log-plan-sheet';/.test(week),
    'PlanToLog is no longer imported'
  );
  return 'required field, single declaration';
});

check('NO DOOR INTO THE DAY SHEET SAYS "MOVE"', () => {
  // Ruth, 18 October 2026, after the sheet's own title was fixed that morning:
  // "It still says 'Move to' which is incorrect. It should say 'Copy to
  // another day'."
  //
  // The sheet ADDS a day and keeps the ones already there - it has never moved
  // anything. Correcting the title inside the sheet left the button that opens
  // it still promising the old behaviour, so the feature stayed hidden behind
  // the same wrong word. A label is not fixed until every door says it.
  assert.ok(/Copy to another day/.test(sheet), 'the button no longer says what it does');
  const visible = sheet
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
  assert.ok(!/>\s*Move to…/.test(visible), '"Move to…" is back on the button');
  assert.ok(
    !/accessibilityLabel=\{`Move \$\{plan\.activity\}/.test(visible),
    'the screen reader is still told it moves'
  );
  // And the sheet it opens must still agree with it.
  const move = fs.readFileSync('mobile/src/components/move-sheet.tsx', 'utf8');
  assert.ok(/Which days for \{activity\}\?/.test(move), 'the sheet title drifted back');
  return 'button and sheet say the same thing';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
