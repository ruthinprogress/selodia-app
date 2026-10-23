// HYDRATION IS NOT ITS OWN LITTLE APP.
//
//   node scripts/check-hydration-uses-the-shared-list.mjs
//
// Ruth, 23 October 2026: "This screen needs bringing up to the rest of the app
// standard, its fallen behind."
//
// HOW IT FELL BEHIND, which is the part worth guarding. The water screen was
// built in September as "the food log's sibling" - the same week stepper, the
// same two-tap delete - by COPYING them. On 27 September Food, Movement and
// Measurements were consolidated onto one shared list with collapsing days, an
// undo toast and a seven-day soft delete. Hydration kept its copy.
//
// Nothing was wrong with it on the day it was written, and nothing told it when
// the family moved. That is how a sibling becomes an orphan: not by anybody
// deciding, but by a copy not being a reference. The screen also still carried
// the four grey "Add a drink" pills that the droplet had replaced on Today in
// September - the same control, two design generations apart, in two places.
//
// So this checks the SHARING, not the appearance. A screen that imports the
// shared list gets every improvement to it for free; a screen that reimplements
// it gets none and nobody finds out for a month.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8').split('\r\n').join('\n');

const VIEW = read('mobile/src/components/water-history-view.tsx');
const SCREEN = read('mobile/src/app/(tabs)/log/water-history.tsx');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

check('the week list is the shared one', () => {
  assert.match(
    VIEW,
    /from '@\/components\/day-log'/,
    'water-history-view is not importing DayLog, so it is drawing its own week again'
  );
  assert.match(VIEW, /<DayLog/, 'DayLog is imported but not rendered');
});

check('it does not draw its own week stepper', () => {
  // The two things its old private stepper was made of. Either one coming back
  // means the shared navigation has been reimplemented beside it.
  assert.doesNotMatch(
    VIEW,
    /chevron-back|chevron-forward/,
    'there are week arrows in here again - DayLog already draws them'
  );
  assert.doesNotMatch(
    VIEW,
    /Back to today/,
    'a second back-to-today control, which DayLog already provides'
  );
});

check('a removed drink can be put back', () => {
  assert.match(
    VIEW,
    /removeEntry\(\s*'hydration_logs'/,
    'deleting a drink is not going through removeEntry, so it has no undo and no '
      + 'seven-day keep - which every other log in the app has'
  );
});

check('the drink still says what it was', () => {
  // Ruth, 21 September 2026: "the hydration log needs to show the source of the
  // hydration or it's going to confuse people". A column of bare volumes is
  // unreadable once a milky tea counts toward water: 300ml of WHAT.
  assert.match(
    VIEW,
    /raw_input/,
    'the drink description is gone, leaving a column of volumes with no source'
  );
});

check('the top control is the droplet Today uses', () => {
  assert.match(
    SCREEN,
    /from '@\/components\/hydration-card'/,
    'the screen is not using HydrationCard, so it has its own logging control again'
  );
  assert.match(SCREEN, /<HydrationCard/, 'HydrationCard is imported but not rendered');
});

check('the explainer is there, in her words', () => {
  assert.match(
    VIEW,
    /any drinks logged in Chat or in Food Log/i,
    'the sentence explaining where the water comes from is missing - without it, a '
      + 'volume she did not type reads as the app inventing things'
  );
});

check('today is one definition, not two', () => {
  // startOfToday moved into lib/week so this screen and the Today panel read
  // the same boundary. Two definitions of "today" maintained apart is the shape
  // this project keeps paying for.
  assert.match(SCREEN, /startOfToday/, 'the screen is not using the shared day boundary');
  assert.doesNotMatch(
    SCREEN,
    /setHours\(0,\s*0,\s*0,\s*0\)/,
    'the screen has its own midnight again, beside the shared one'
  );
});

// -- every case above must be able to fail ---------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('shared list required', () => assert.doesNotMatch(VIEW, /<DayLog/));
mustFail('own stepper rejected', () => assert.match(VIEW, /chevron-back/));
mustFail('undo required', () => assert.doesNotMatch(VIEW, /removeEntry\(\s*'hydration_logs'/));
mustFail('droplet required', () => assert.doesNotMatch(SCREEN, /<HydrationCard/));
mustFail('explainer required', () =>
  assert.doesNotMatch(VIEW, /any drinks logged in Chat or in Food Log/i)
);

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
