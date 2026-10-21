// A DAY IS READ BEFORE IT IS EDITED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-cycle-day-modes.mjs
//
// Screens 4, 5 and 7 of Ruth's artwork (21 October 2026). The day screen was a
// form and only a form: opening a day from her history put her in front of
// twenty-five chips and six pickers, with what she had actually written that
// day scattered among them as selected states. Reading back "what did I log on
// the 24th?" meant decoding the form.
//
// THREE THINGS THIS GUARDS, and the first is the one that decides whether the
// whole change was worth making:
//
//   WHICH MODE A DAY OPENS IN IS DECIDED BY THE DAY. A day with something on
//   it is a record, because she came to read it. A day with nothing on it is
//   the form, because an empty record is a screen saying "nothing" with a
//   button underneath. Deciding it by where she came from instead would need
//   every caller to get it right, and one of them would not.
//
//   FINISHING DOES NOT LEAVE HER ON THE FORM. Her drawing puts a stop between
//   saving and whatever is next, with the record offered and chat offered.
//
//   EMPTYING A DAY IS NOT A SAVE. Removing everything deletes that day's
//   record, which is a real thing to want - and a tick over "Today's log
//   saved" would be the app telling her something it had just undone.

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

const screen = fs.readFileSync('mobile/src/app/(tabs)/log/cycle-day.tsx', 'utf8');
const view = fs.readFileSync('mobile/src/components/cycle-day-view.tsx', 'utf8');
const saved = fs.readFileSync('mobile/src/components/cycle-day-saved.tsx', 'utf8');

console.log('\n  READING A DAY, WRITING A DAY, AND FINISHING\n');

check('THE DAY DECIDES WHICH MODE IT OPENS IN', () => {
  assert.ok(/setMode\(row \? 'view' : 'edit'\)/.test(screen),
    'the mode is not decided by whether the day holds a record');
  // And it is re-decided every time the day changes, or stepping back a day
  // from a full one would show that day's record in the previous day's form.
  const at = screen.indexOf("setMode(row ? 'view' : 'edit')");
  const around = screen.slice(Math.max(0, at - 2000), at);
  assert.ok(/\.eq\('day', day\)/.test(around), 'the record is not re-read per day');
  return 'full opens as a record, empty opens as the form';
});

check('AND "ANYTHING TO NOTE TODAY?" STILL LANDS ON THE FORM', () => {
  // Screen 6. It works because of the rule above rather than because of a
  // parameter - a day with nothing on it IS the form - so what this guards is
  // that nothing has been added that overrides it on the way in.
  assert.ok(!/params\.(mode|edit)/.test(screen), 'the mode is being passed in, which the rule above decides');
  assert.ok(/useState<'view' \| 'edit' \| 'saved'>\('edit'\)/.test(screen),
    'the screen no longer starts on the form before the day has loaded');
  return 'decided by the day, never by the caller';
});

check('FINISHING DOES NOT LEAVE HER ON THE FORM', () => {
  const at = screen.indexOf('async function save()');
  const body = screen.slice(at, screen.indexOf('const placement', at));
  assert.ok(/setMode\('saved'\)/.test(body), 'saving leaves her on the form she just finished');
  assert.ok(!/setNote\(`Saved for/.test(body), 'the old grey line is still the only confirmation');
  // And the stop offers both ways on, which is the half of her drawing that
  // keeps the form from being a dead end.
  assert.ok(/View the record/.test(saved), 'the record is not offered');
  assert.ok(/add more details in chat/.test(saved), 'chat is not offered');
  return 'a stop, with the record and chat on it';
});

check('EMPTYING A DAY IS NOT REPORTED AS A SAVE', () => {
  const at = screen.indexOf('isEmptyDay(value)');
  const body = screen.slice(at, at + 500);
  assert.ok(/setEmptied\(true\)/.test(body), 'emptying a day is not distinguished from saving one');
  assert.ok(/setMode\('saved'\)/.test(body), 'emptying a day says nothing at all');
  // The confirmation has to act on it, not just receive it.
  // THE TICK ITSELF HAS TO CHANGE, not just the colour behind it. A green
  // check over "Nothing recorded" would be the app ticking off an erasure.
  assert.ok(
    /name=\{deleted \? '[a-z-]+' : 'check'\}/.test(saved),
    'the same tick is drawn whether the day was saved or emptied'
  );
  assert.ok(/Nothing recorded for/.test(screen), 'nothing says the day was emptied');
  return 'its own words, and no tick';
});

check('THE RECORD DRAWS ONLY WHAT IS THERE', () => {
  // No "none", no "not recorded", no greyed placeholder. An empty section is a
  // day she had nothing to say about, and a column of "none" turns that into a
  // column of failures to log.
  assert.ok(!/\bnot recorded\b/i.test(view.replace(/\/\/.*$/gm, '')), 'the record prints "not recorded"');
  assert.ok(!/>None</.test(view), 'the record prints "None"');
  // Each section is conditional on its own content.
  for (const [field, guard] of [
    ['Flow', '{flow && ('],
    ['Symptoms', '{symptoms.length > 0 && ('],
    ['Cervical mucus', '{entry.mucus && ('],
    ['Notes', '{notes && ('],
  ]) {
    assert.ok(view.includes(guard), `${field} is drawn whether or not it holds anything`);
  }
  // And a day with nothing at all says so once, rather than silently.
  assert.ok(/Nothing was recorded on this day/.test(view), 'an empty record is a blank screen');
  return 'empty sections are not drawn';
});

check('AND THE DAY BAR SURVIVES EVERY MODE', () => {
  // Stepping to the day before is as useful while reading as while writing, and
  // a control that vanishes between two views of one screen is the dead control
  // principle 8 rules out. The bar sits above the branch, so this is structural.
  const bar = screen.indexOf('styles.dayBar');
  const branch = screen.indexOf("{mode === 'saved' ?");
  assert.ok(bar > -1 && branch > -1, 'the day bar or the branch is gone');
  assert.ok(bar < branch, 'the day bar moved inside the branch and now comes and goes');
  return 'above the branch, so it never moves';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
