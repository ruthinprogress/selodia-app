// Can a week of catch-up food land on the right days, and can a non-meal be
// kept out of the food log?
//
// Both failures are real, from Ruth's phone on 2026-09-16: seven days of food
// written as nothing at all, and "It's not gone into the log" written into
// food_logs at 0 kcal. Pure functions, no API, free to run.
//
//   npx tsx scripts/probe-food-backfill.mjs

import { buildFoodRows, hasFood } from '../app/lib/food-logging.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

const NOW = new Date('2026-09-16T08:02:00.000Z');
const meal = (over = {}) => ({ kcal: 700, protein_g: 30, meal_label: 'Dinner', items: [], ...over });

console.log('\n  A MESSAGE CAN BE MORE THAN ONE DAY\n');
const week = buildFoodRows(
  {
    entries: [
      meal({ detected_date: '2026-09-07', entry_text: 'Pizza and chips' }),
      meal({ detected_date: '2026-09-08', entry_text: 'Burger, beer, salad with chicken' }),
      meal({ detected_date: '2026-09-09', entry_text: 'Turkish feast with ribs' }),
    ],
  },
  'Catch up my food log: Mon 7th pizza and chips...',
  NOW
);
check('one row per day', week.length, 3);
check('each row lands on its own day', week.map((r) => r.happenedAt.slice(0, 10)), ['2026-09-07', '2026-09-08', '2026-09-09']);
check('the time of day comes from now', week[0].happenedAt.slice(11, 19), '08:02:00');
check("each row keeps that day's words", week[1].rawText, 'Burger, beer, salad with chicken');

console.log('\n  A MEAL WITH NO DAY IS TODAY\n');
const todayRows = buildFoodRows({ entries: [meal({ entry_text: 'Porridge' })] }, 'porridge', NOW);
check('no detected_date means now', todayRows[0].happenedAt, NOW.toISOString());
check('a malformed date is not trusted', buildFoodRows({ entries: [meal({ detected_date: '7th Sept' })] }, 'x', NOW)[0].happenedAt, NOW.toISOString());

console.log('\n  WHAT IS NOT FOOD IS NOT LOGGED\n');
check('a complaint parses to nothing', buildFoodRows({ entries: [] }, "It's not gone into the log", NOW), []);
check('an entry with no food in it is dropped', buildFoodRows({ entries: [{ kcal: 0, protein_g: 0, items: [] }] }, 'x', NOW), []);
check('  and a real meal beside it survives', buildFoodRows({ entries: [{ kcal: 0, items: [] }, meal({ entry_text: 'Soup' })] }, 'x', NOW).length, 1);
check('no entries key at all', buildFoodRows({}, 'x', NOW), []);
check('entries that is not an array', buildFoodRows({ entries: 'pizza' }, 'x', NOW), []);
check('zero kcal but real items still counts', hasFood({ kcal: 0, items: [{ name: 'black coffee' }] }), true);
check('a drink with calories counts', hasFood({ kcal: 120, items: [] }), true);
check('protein alone counts', hasFood({ kcal: 0, protein_g: 20, items: [] }), true);
check('nothing at all does not', hasFood({ items: [] }), false);

console.log('\n  THE ROW KEEPS WHAT WAS PARSED\n');
const one = buildFoodRows({ entries: [meal({ entry_text: 'Soup', meal_label: 'Lunch', kcal: 320 })] }, 'soup', NOW)[0];
check('the label survives', one.fields.meal_label, 'Lunch');
check('the calories survive', one.fields.kcal, 320);
check('confidence defaults to clear', one.fields.confidence, 'clear');
check('the whole message is the fallback text', buildFoodRows({ entries: [meal()] }, 'two poached eggs', NOW)[0].rawText, 'two poached eggs');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
