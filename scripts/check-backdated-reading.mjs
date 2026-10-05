// A READING FROM SATURDAY IS NOT A READING FROM TODAY.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-backdated-reading.mjs
//
// Ruth, 5 October 2026: "Bug - scales log from Saturday but talk about
// 'tomorrow' - makes no sense."
//
// WHAT THE FAULT WAS, because it is not the kind a test usually looks for.
// weighInFacts assumed every reading was today's. Nothing calculated anything
// wrongly: the model was handed three days of movement that were the three days
// before TODAY rather than before the reading, a salt figure for a day the
// reading knows nothing about, and no statement anywhere that the reading was
// two days old. So it did the only thing it could and talked about where
// tomorrow would land.
//
// A MISSING FACT, NOT A WRONG ONE. That is the third time on this file and the
// reason it exists at all: the first two were an invented session and
// self-performed arithmetic. All three come from the same place, which is that
// absence is not information until somebody states it.
//
// SO THE CASES BELOW ARE MOSTLY ABOUT WHAT IS SAID. Every one of them runs the
// real function over a real shape and reads the block it produces, and the last
// one proves the suite fails against the version that was shipped.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { weighInFacts } = await import(root + '/app/lib/weigh-in-facts.ts');

/** Monday 5 October 2026, which is the day she reported it. */
const MONDAY = new Date('2026-10-05T09:00:00Z');
const SATURDAY = '2026-10-03T07:30:00Z';
const SUNDAY = '2026-10-04T07:30:00Z';

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

console.log('\n  A BACKDATED WEIGH-IN\n');

const backdated = () =>
  weighInFacts(
    [{ measured_at: SATURDAY, weight_kg: 56.9, body_fat_pct: null }],
    [],
    [],
    MONDAY
  );

const todays = () =>
  weighInFacts(
    [{ measured_at: '2026-10-05T07:30:00Z', weight_kg: 56.9, body_fat_pct: null }],
    [],
    [],
    MONDAY
  );

check('it says the reading is not from today, and names both days', () => {
  const block = backdated();
  assert.ok(/NOT FROM TODAY/.test(block), 'nothing says the reading is old');
  assert.ok(block.includes('2026-10-03'), "the reading's own date is not stated");
  assert.ok(block.includes('2026-10-05'), 'today is not stated');
  return 'today is Monday, the reading is Saturday';
});

check('it forbids the sentence she was actually shown', () => {
  // "Worth seeing where tomorrow lands", about a day she has not weighed on.
  const block = backdated();
  assert.ok(/tomorrow/.test(block), 'the word is not addressed at all');
  assert.ok(
    /do not say[^.]*"tomorrow"|"tomorrow" as though/.test(block),
    'the model is not told not to talk about tomorrow'
  );
  assert.ok(/next weigh-in/.test(block), 'it does not say what to do instead');
  return 'and it offers "your next weigh-in" in its place';
});

check('the three days of movement are the reading\'s, not today\'s', () => {
  // A session on the Sunday is AFTER a Saturday reading, so it cannot explain it.
  // Before the fix this window started three days before Monday and swept it in.
  const block = weighInFacts(
    [{ measured_at: SATURDAY, weight_kg: 56.9, body_fat_pct: null }],
    [{ happened_at: SUNDAY, activity_type: 'heavy squats', duration_min: 60, intensity: 'hard' }],
    [],
    MONDAY
  );
  assert.ok(
    /NOTHING AT ALL IS LOGGED/.test(block),
    'a session logged AFTER the reading is being offered as context for it'
  );
  assert.ok(!/heavy squats/.test(block), 'the later session is still in the block');
  return 'a session after the reading cannot explain the reading';
});

check('the window says which three days it means', () => {
  assert.ok(
    /IN THE THREE DAYS UP TO 2026-10-03/.test(backdated()),
    'the movement window does not name the day it is counted from'
  );
  assert.ok(
    /IN THE LAST THREE DAYS/.test(todays()),
    "today's reading lost the plain wording"
  );
  return 'named when it matters, plain when it does not';
});

check('the salt line is about the day of the reading', () => {
  const block = weighInFacts(
    [{ measured_at: SATURDAY, weight_kg: 56.9, body_fat_pct: null }],
    [],
    [{ happened_at: SATURDAY, sodium_mg: 3200 }],
    MONDAY
  );
  assert.ok(/SALT ON 2026-10-03/.test(block), 'the salt line still says TODAY');
  assert.ok(/3200 mg/.test(block), "Saturday's sodium is not counted");
  // AND MONDAY'S FOOD IS NOT HERS TO BLAME. A salty Monday says nothing about a
  // Saturday reading, and before the fix it was the only day counted.
  const wrongDay = weighInFacts(
    [{ measured_at: SATURDAY, weight_kg: 56.9, body_fat_pct: null }],
    [],
    [{ happened_at: '2026-10-05T12:00:00Z', sodium_mg: 3200 }],
    MONDAY
  );
  assert.ok(/not known/.test(wrongDay), "Monday's salt is being offered for Saturday's reading");
  return "Saturday's salt, and not Monday's";
});

check("today's reading says nothing about being backdated", () => {
  const block = todays();
  assert.ok(!/NOT FROM TODAY/.test(block), 'it warns about a reading taken today');
  assert.ok(/SALT TODAY/.test(block), 'the plain salt wording is gone');
  return 'no warning where there is nothing to warn about';
});

check('with no reading at all it still refuses to describe a change', () => {
  const block = weighInFacts([], [], [], MONDAY);
  assert.ok(/there is not one/.test(block), 'it no longer says there is no previous reading');
  assert.ok(!/NOT FROM TODAY/.test(block), 'it warns about a reading that does not exist');
  return 'nothing to compare, and it says so';
});

check('and this check can fail', () => {
  // THE SHIPPED VERSION, in one line: every window anchored on now. If these
  // cases pass against it, they are not testing what Ruth reported.
  const asShipped = (measurements, activity, food, today) =>
    weighInFacts(
      measurements.map((m) => ({ ...m, measured_at: today.toISOString() })),
      activity,
      food,
      today
    );
  const block = asShipped(
    [{ measured_at: SATURDAY, weight_kg: 56.9, body_fat_pct: null }],
    [],
    [],
    MONDAY
  );
  assert.ok(!/NOT FROM TODAY/.test(block), 'the fixture did not reproduce the old behaviour');
  assert.ok(/SALT TODAY/.test(block), 'the fixture did not reproduce the old behaviour');
  return 'the version she saw is detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
