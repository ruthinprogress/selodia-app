// HAS THIS HAPPENED AT THIS POINT BEFORE?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-symptom-lookback.mjs
//
// Ruth's example, 9 October 2026: "if a user sayd, 'i feel bloated and has pain
// in my lower abdomen', and they have logged the same for the past two month,
// selodia can reasonable suggest it could be ovulation, suggest it and also ask
// if they've noticed any other changes like milkier discharge or more musky
// scent."
//
// This is the part that decides whether there is anything to say. It is built
// on her real cycle lengths - 29, 24, 35, 26, 31 - because those are what make
// the question hard: the naive version compares day numbers and would claim a
// pattern across three different phases.
//
// THE TWO WAYS THIS FEATURE COULD EMBARRASS HER, both checked below:
//   - claiming a pattern from one previous occasion, which is a coincidence
//   - claiming a pattern across cycles where the same day number is a
//     different phase

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { buildCycles } = await import(root + '/app/lib/cycle-position.ts');
const { recurrences, monthsOf, lookbackPrompt, MIN_PREVIOUS_OCCASIONS } = await import(
  root + '/app/lib/symptom-lookback.ts'
);

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

// Her cycles: 29, 24, 35, 26, 31, then one open.
const CYCLES = buildCycles([
  '2026-05-04', '2026-06-02', '2026-06-26', '2026-07-31', '2026-08-26', '2026-09-26',
]);

console.log('\n  HAS THIS HAPPENED AT THIS POINT BEFORE\n');

check('her example: bloating two months running, at a comparable point', () => {
  // Day 6 of three cycles - early, so counted forward and comparable whatever
  // the lengths.
  const history = [
    { day: '2026-10-01', symptoms: ['bloated', 'lower abdomen pain'] },
    { day: '2026-08-31', symptoms: ['bloated', 'lower abdomen pain'] },
    { day: '2026-08-05', symptoms: ['bloated'] },
  ];
  const found = recurrences(CYCLES, history, '2026-10-01');
  assert.ok(found.length > 0, 'nothing found for the example this exists to serve');
  const bloated = found.find((r) => r.symptom === 'bloated');
  assert.ok(bloated, `bloated not among ${JSON.stringify(found.map((f) => f.symptom))}`);
  assert.strictEqual(bloated.days.length, 2, JSON.stringify(bloated.days));
  return `"bloated" on 2 previous days, ${monthsOf(bloated.days)}`;
});

check('and this check can fail', () => {
  // Everything turns on recurrences returning something, which a function that
  // returned every day would also do. So: a symptom logged once before must
  // produce nothing, and a symptom never logged before must produce nothing.
  const once = recurrences(
    CYCLES,
    [
      { day: '2026-10-01', symptoms: ['bloated'] },
      { day: '2026-08-31', symptoms: ['bloated'] },
    ],
    '2026-10-01'
  );
  assert.strictEqual(once.length, 0, 'one previous occasion was reported as a pattern');
  const never = recurrences(
    CYCLES,
    [{ day: '2026-10-01', symptoms: ['sore elbow'] }],
    '2026-10-01'
  );
  assert.strictEqual(never.length, 0, 'a first-ever symptom was reported as a pattern');
  return 'one occasion is a coincidence; a first is nothing';
});

check('TWO IS THE FLOOR, and it is a number somebody chose', () => {
  assert.strictEqual(MIN_PREVIOUS_OCCASIONS, 2);
  const history = [
    { day: '2026-10-01', symptoms: ['bloated'] },
    { day: '2026-08-31', symptoms: ['bloated'] },
    { day: '2026-08-05', symptoms: ['bloated'] },
  ];
  assert.strictEqual(recurrences(CYCLES, history, '2026-10-01').length, 1);
  return 'three occasions including today';
});

check('it will not match across cycles where the day number means a different phase', () => {
  // Day 14 of the 24-day cycle and day 14 of the 35-day cycle. Same number,
  // eleven days apart in length, genuinely different phases.
  const history = [
    { day: '2026-07-09', symptoms: ['cramps'] }, // day 14 of 35
    { day: '2026-06-15', symptoms: ['cramps'] }, // day 14 of 24
    { day: '2026-05-17', symptoms: ['cramps'] }, // day 14 of 29
  ];
  const found = recurrences(CYCLES, history, '2026-07-09');
  // 35 vs 29 is 6 apart, outside the 4-day tolerance; 35 vs 24 is 11 apart.
  assert.strictEqual(found.length, 0, `claimed a pattern across ${JSON.stringify(found)}`);
  return 'three day-14s in a 35, a 24 and a 29, all refused';
});

check('but it does match when the cycles really are alike', () => {
  // 35 and 31 are four apart, inside the tolerance.
  const history = [
    { day: '2026-07-09', symptoms: ['cramps'] }, // day 14 of 35
    { day: '2026-09-08', symptoms: ['cramps'] }, // day 14 of 31
    { day: '2026-09-09', symptoms: ['cramps'] }, // day 15 of 31
  ];
  const found = recurrences(CYCLES, history, '2026-07-09');
  assert.ok(found.length > 0, 'two comparable cycles produced nothing');
  return 'a 35 and a 31 do compare';
});

check('late-cycle symptoms match on days before the period, not day number', () => {
  // Four days before, in cycles of 24, 35 and 26. Forward those are days 21,
  // 32 and 23 - nothing alike. Backward they are the same place.
  const history = [
    { day: '2026-07-27', symptoms: ['sore breasts'] }, // 4 before, 35-day
    { day: '2026-06-22', symptoms: ['sore breasts'] }, // 4 before, 24-day
    { day: '2026-08-22', symptoms: ['sore breasts'] }, // 4 before, 26-day
  ];
  const found = recurrences(CYCLES, history, '2026-07-27');
  assert.strictEqual(found.length, 1, JSON.stringify(found));
  assert.strictEqual(found[0].days.length, 2);
  return 'days 21, 32 and 23 forward; all four before a period';
});

check('the current cycle never claims a late-phase pattern', () => {
  // Its next period has not happened, so there is no "days before" to compare.
  const history = [
    { day: '2026-10-20', symptoms: ['sore breasts'] }, // open cycle
    { day: '2026-07-27', symptoms: ['sore breasts'] },
    { day: '2026-06-22', symptoms: ['sore breasts'] },
  ];
  const found = recurrences(CYCLES, history, '2026-10-20');
  assert.strictEqual(found.length, 0, 'compared an unfinished cycle to finished ones');
  return 'no end date, so nothing claimed';
});

check('her words are matched, not a guess at what she meant', () => {
  const history = [
    { day: '2026-10-01', symptoms: ['that dragging feeling low down'] },
    { day: '2026-08-31', symptoms: ['That Dragging Feeling Low Down'] },
    { day: '2026-08-05', symptoms: ['dragging'] },
  ];
  const found = recurrences(CYCLES, history, '2026-10-01');
  // Case differences are the same symptom. "dragging" alone is NOT - a fuzzy
  // match would make the app claim a pattern she never described.
  assert.strictEqual(found.length, 0, 'matched on a partial word');
  const two = recurrences(
    CYCLES,
    [
      { day: '2026-10-01', symptoms: ['cramps'] },
      { day: '2026-08-31', symptoms: ['Cramps'] },
      { day: '2026-08-05', symptoms: ['CRAMPS'] },
    ],
    '2026-10-01'
  );
  assert.strictEqual(two.length, 1, 'case differences were treated as different symptoms');
  return 'case ignored, partial words refused';
});

check('the months read the way she would say them', () => {
  assert.strictEqual(monthsOf(['2026-08-31']), 'August');
  assert.strictEqual(monthsOf(['2026-08-31', '2026-07-09']), 'August and July');
  assert.strictEqual(monthsOf(['2026-08-31', '2026-07-09', '2026-06-15']), 'August, July and June');
  // Two days in one month is one month, not "August and August".
  assert.strictEqual(monthsOf(['2026-08-31', '2026-08-05']), 'August');
  return '"August and July", and never "August and August"';
});

check('the prompt states the fact and refuses the diagnosis', () => {
  const history = [
    { day: '2026-10-01', symptoms: ['bloated'] },
    { day: '2026-08-31', symptoms: ['bloated'] },
    { day: '2026-08-05', symptoms: ['bloated'] },
  ];
  const block = lookbackPrompt(recurrences(CYCLES, history, '2026-10-01'));
  assert.ok(block.includes('bloated'), block);
  assert.ok(/often points to/i.test(block), 'the allowed form is not given');
  assert.ok(/is a diagnosis/i.test(block), 'the forbidden form is not named');
  // IT MUST NOT CONCLUDE ANYTHING ITSELF - but it DOES quote the forbidden
  // sentence, because showing the model the exact wrong wording works better
  // than describing it. So the test is where the phrase appears, not whether.
  // Outside quotation marks it would be an instruction; inside them it is an
  // example of what not to say. The first version of this check searched the
  // whole block and failed on the prompt's own good practice.
  const unquoted = block.replace(/"[^"]*"/g, '');
  assert.ok(
    !/you are ovulating|this is ovulation/i.test(unquoted),
    'the block asserts the claim rather than quoting it as forbidden'
  );
  assert.ok(
    /"You are ovulating" is a diagnosis/.test(block),
    'the forbidden form is no longer shown as forbidden'
  );
  assert.strictEqual(lookbackPrompt([]), '', 'an empty finding still produced a block');
  return 'states the fact, gives both forms, concludes nothing';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
