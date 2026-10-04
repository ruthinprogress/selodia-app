// WHEN A TURN LOGS A WHOLE DAY, DOES THE CHAT SHOW WHAT WENT IN?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-day-summary.mjs
//
// Ruth, 4 October 2026, after voice-logging her Saturday: "no summary table came
// through in the chat to show what was logged."
//
// The itemised table draws ONE meal. A turn that logged four set its food_log_id
// to null and drew nothing, on the reasoning that a catch-up of seven days has no
// single table to show and picking one would put that day's breakdown under a
// reply about the week. The reasoning was right and the conclusion was wrong:
// showing nothing leaves a sentence claiming a save with no way to check it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { buildDaySummaryRows, mealSummaryLabel } = await import(
  root + '/mobile/src/lib/food-breakdown-table.ts'
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

console.log('\n  A DAY LOGGED AT ONCE STILL SHOWS WHAT WENT IN\n');

// Her Saturday, from food_logs.
const SATURDAY = [
  { id: 'b', meal_label: 'Breakfast', raw_text: 'Breakfast - two black coffees, cheesy omelette', happened_at: '2026-10-03T08:00:00Z', kcal: 179, protein_g: 14 },
  { id: 'l', meal_label: 'Lunch', raw_text: 'Lunch - a flapjack, two glace cherry chocolates', happened_at: '2026-10-03T13:00:00Z', kcal: 320, protein_g: 4 },
  { id: 'p', meal_label: 'Pub', raw_text: 'Pub - an Aperol spritz, a lager shandy, a mini lemon cupcake', happened_at: '2026-10-03T18:00:00Z', kcal: 240, protein_g: 2 },
  { id: 'd', meal_label: 'Dinner', raw_text: 'Yesterday: Dinner - fish and chips and mushy peas', happened_at: '2026-10-03T20:00:00Z', kcal: 680, protein_g: 35 },
];

check('every meal gets a row, plus a total', () => {
  const rows = buildDaySummaryRows(SATURDAY);
  assert.strictEqual(rows.length, 5, `${rows.length} rows for four meals and a total`);
  assert.strictEqual(rows.at(-1).isTotal, true, 'the last row is not the total');
  assert.strictEqual(rows.filter((r) => r.isTotal).length, 1, 'more than one total');
  return rows.map((r) => r.label).join(' | ').slice(0, 72);
});

check('the total is the sum of what is shown', () => {
  const rows = buildDaySummaryRows(SATURDAY);
  const total = rows.at(-1);
  // 179 + 320 + 240 + 680 = 1419; 14 + 4 + 2 + 35 = 55.
  assert.strictEqual(total.kcal, '~1419', `total kcal is ${total.kcal}`);
  assert.strictEqual(total.protein, '~55g', `total protein is ${total.protein}`);
  assert.ok(/4 meals/.test(total.label), `the total does not say how many: ${total.label}`);
  return `${total.kcal} kcal, ${total.protein}`;
});

check('the rows are in the order she ate them', () => {
  // Shuffled in, because the query returns them in whatever order it likes and
  // a day summary out of order reads as wrong even when every figure is right.
  const rows = buildDaySummaryRows([SATURDAY[3], SATURDAY[0], SATURDAY[2], SATURDAY[1]]);
  assert.deepStrictEqual(
    rows.filter((r) => !r.isTotal).map((r) => r.key),
    ['b', 'l', 'p', 'd'],
    'the meals came out in the wrong order'
  );
  return 'breakfast, lunch, pub, dinner';
});

check('a meal is named by her words, with the category once', () => {
  // "Dinner - fish and chips" under a column already headed Dinner would print
  // the word twice; the parse's own "Yesterday:" prefix is not part of the food.
  const label = mealSummaryLabel(SATURDAY[3]);
  assert.ok(/fish and chips/.test(label), `the food is missing: ${label}`);
  assert.strictEqual(
    (label.match(/dinner/gi) ?? []).length,
    1,
    `"Dinner" appears more than once: ${label}`
  );
  assert.ok(!/yesterday/i.test(label), `the "Yesterday:" prefix survived: ${label}`);
  return label;
});

check('a meal with no words still says something', () => {
  const label = mealSummaryLabel({ id: 'x', meal_label: 'Snack', raw_text: null, happened_at: null, kcal: null, protein_g: null });
  assert.strictEqual(label, 'Snack');
  const bare = mealSummaryLabel({ id: 'y', meal_label: null, raw_text: null, happened_at: null, kcal: null, protein_g: null });
  assert.strictEqual(bare, 'Logged', `a nameless entry reads as "${bare}"`);
  return 'never an empty row';
});

check('a missing figure is not counted as zero', () => {
  const rows = buildDaySummaryRows([
    SATURDAY[0],
    { ...SATURDAY[1], kcal: null, protein_g: null },
  ]);
  const total = rows.at(-1);
  assert.strictEqual(total.kcal, '~179', `an unknown meal was counted: ${total.kcal}`);
  return 'unknown contributes nothing, not zero';
});

// ---- and the two never both draw ----------------------------------------
check('a single meal still gets its itemised table, not a summary', () => {
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(
    /breakdownFoodLogId = entries\.length === 1 \? entries\[0\]\.id : null;/.test(route),
    'the single-meal path changed - the itemised table is what one meal should show'
  );
  const chat = readFileSync('mobile/src/app/(tabs)/index.tsx', 'utf8');
  assert.ok(
    /!m\.foodLogId && \(m\.foodLogIds\?\.length \?\? 0\) > 1/.test(chat),
    'the summary is not gated on there being no single-meal table, so a turn ' +
      'could draw both an itemised table and a summary of the same food'
  );
  return 'one table or the other, never both';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
