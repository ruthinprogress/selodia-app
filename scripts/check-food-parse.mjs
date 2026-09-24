// DOES THE REAL PARSER ACTUALLY DO WHAT TONIGHT'S FIXES CLAIM?
//
// The probes test the pure functions. This tests the whole path with the real
// model, on Ruth's own entries, WITHOUT WRITING A SINGLE ROW - the Supabase
// client is a stub that records what would have been inserted. That matters
// twice over: it is her production database, and a verification that changes
// the thing it is verifying is not a verification.
//
// It costs a few Haiku calls. Run it after changing the food prompt, the
// itemisation guard or the drinks rule.
//
//   npx tsx scripts/check-food-parse.mjs
//
// Env: ANTHROPIC_API_KEY (from .env.local)

import fs from 'node:fs';
import path from 'node:path';

const E = { ...process.env };
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] ||= line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
process.env.ANTHROPIC_API_KEY = E.ANTHROPIC_API_KEY;

const { logFoodFromText } = await import('../app/lib/food-logging.ts');

/** Everything the code would have written, captured instead of sent. */
function stubDb() {
  const written = { food_logs: [], food_items: [], hydration_logs: [] };
  const chain = (table) => {
    const self = {
      select: () => self,
      gte: () => self,
      lte: () => self,
      lt: () => self,
      gt: () => self,
      in: () => self,
      is: () => self,
      not: () => self,
      or: () => self,
      ilike: () => self,
      eq: () => self,
      neq: () => self,
      order: () => self,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      limit: async () => ({ data: [], error: null }),
      // Some reads end without limit(), so the chain has to be awaitable too.
      then: (f) => Promise.resolve({ data: [], error: null }).then(f),
      insert: (rows) => {
        const list = Array.isArray(rows) ? rows : [rows];
        written[table].push(...list);
        const withIds = list.map((r, i) => ({ ...r, id: `${table}-${written[table].length + i}` }));
        const res = { data: withIds, error: null };
        return { select: async () => res, then: (f) => Promise.resolve(res).then(f) };
      },
      update: () => self,
      delete: () => self,
      upsert: async () => ({ error: null }),
    };
    return self;
  };
  return { written, from: (t) => chain(t) };
}

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    if (detail) console.log(`        ${detail}`);
  }
}

async function parse(text) {
  const db = stubDb();
  await logFoodFromText(db, 'check-user', text);
  return db.written;
}

console.log('\n  THE REAL PARSER, ON HER ACTUAL ENTRIES\n');
console.log('  (no rows are written; the database is a stub)\n');

// ---- BUG 18: several things named must be several rows -------------------
{
  const w = await parse('Mug of tea and a cookie');
  const items = w.food_items.map((i) => i.name);
  console.log(`\n  "Mug of tea and a cookie"\n    items: ${JSON.stringify(items)}`);
  check('bug 18: tea and a cookie are two rows, not one lump', w.food_items.length >= 2, `got ${w.food_items.length}`);
  check('bug 17: the tea reaches hydration as well', w.hydration_logs.length >= 1, JSON.stringify(w.hydration_logs));
}

{
  const w = await parse('Herbal tea, English tea with milk, and a biscuit');
  const items = w.food_items.map((i) => i.name);
  console.log(`\n  "Herbal tea, English tea with milk, and a biscuit"\n    items: ${JSON.stringify(items)}`);
  check('bug 18: three things named, three rows', w.food_items.length >= 3, `got ${w.food_items.length}`);
  const ml = w.hydration_logs.reduce((n, h) => n + (h.ml ?? 0), 0);
  check('both teas reach hydration', ml >= 400, `${ml}ml`);
}

// ---- A DRINK MIXED INTO A MEAL, which is the shape that failed -----------
//
// 23 September 2026. Every check above passed, two days running, while this
// was broken: they all name the drink on its own or at the head of a list.
// Her actual entry buried it at the end of a sentence about food, and the
// model dropped it from `items` and from `drinks` while telling her it had
// been added. The checks were the wrong shape, not too few.
{
  const w = await parse('Chicken salad with avocado and a flat white for lunch');
  const items = w.food_items.map((i) => i.name);
  const ml = w.hydration_logs.reduce((n, h) => n + (h.ml ?? 0), 0);
  console.log(`\n  "Chicken salad with avocado and a flat white for lunch"\n    items: ${JSON.stringify(items)}\n    hydration: ${ml}ml`);
  const hasDrink = items.some((n) => /flat white|coffee|latte/i.test(String(n)));
  check('the flat white is one of the items', hasDrink, JSON.stringify(items));
  check('the flat white reaches hydration', ml > 0, `${ml}ml`);
  const kcal = w.food_logs.reduce((n, f) => n + (f.kcal ?? 0), 0);
  check('and the meal still carries its calories', kcal > 200, `${kcal} kcal`);
}

{
  const w = await parse('Porridge with berries, then a latte on the way to work');
  const items = w.food_items.map((i) => i.name);
  const ml = w.hydration_logs.reduce((n, h) => n + (h.ml ?? 0), 0);
  console.log(`\n  "Porridge with berries, then a latte on the way to work"\n    items: ${JSON.stringify(items)}\n    hydration: ${ml}ml`);
  check('the latte is itemised', items.some((n) => /latte|coffee/i.test(String(n))), JSON.stringify(items));
  check('the latte reaches hydration', ml > 0, `${ml}ml`);
}

// ---- BUG 17: her coffee entry -------------------------------------------
{
  const w = await parse('three black coffees');
  const ml = w.hydration_logs.reduce((n, h) => n + (h.ml ?? 0), 0);
  console.log(`\n  "three black coffees"\n    hydration: ${ml}ml`);
  check('three coffees count as three, not one', ml >= 700, `${ml}ml`);
}

{
  const w = await parse('a mug of tea with milk');
  const kcal = w.food_logs.reduce((n, f) => n + (f.kcal ?? 0), 0);
  const ml = w.hydration_logs.reduce((n, h) => n + (h.ml ?? 0), 0);
  console.log(`\n  "a mug of tea with milk"\n    ${kcal} kcal, ${ml}ml hydration`);
  check('a milky tea carries calories', kcal > 0, `${kcal} kcal`);
  check('and still counts as hydration', ml > 0, `${ml}ml`);
}

// ---- Alcohol is food, never hydration -----------------------------------
{
  const w = await parse('two glasses of red wine');
  const kcal = w.food_logs.reduce((n, f) => n + (f.kcal ?? 0), 0);
  const ml = w.hydration_logs.reduce((n, h) => n + (h.ml ?? 0), 0);
  console.log(`\n  "two glasses of red wine"\n    ${kcal} kcal, ${ml}ml hydration`);
  check('wine carries calories', kcal > 0, `${kcal} kcal`);
  check('wine is NOT hydration', ml === 0, `${ml}ml`);
}

// ---- The stated-weight guard, from her omelette --------------------------
{
  const w = await parse('50g cheese omelette');
  const kcal = w.food_logs.reduce((n, f) => n + (f.kcal ?? 0), 0);
  console.log(`\n  "50g cheese omelette"\n    ${kcal} kcal`);
  check('fifty grams of omelette is not 385 kcal', kcal > 0 && kcal < 220, `${kcal} kcal`);
}

// ---- THE THREE NEW MACROS, and their right to be absent ------------------
//
// 24 September 2026, with "What I track". The risk here is not that the model
// omits saturated fat, sugar or fibre - it is that it INVENTS them. A made-up
// 4g of fibre is indistinguishable on a row from a measured one, and somebody
// who switched fibre on did it in order to watch it.
{
  const w = await parse('Two slices of wholemeal toast with butter');
  const f = w.food_logs[0] ?? {};
  console.log(`\n  "Two slices of wholemeal toast with butter"`);
  console.log(`    sat fat: ${f.saturated_fat_g}  sugar: ${f.sugar_g}  fibre: ${f.fibre_g}`);
  check('wholemeal bread has fibre, and it came through', typeof f.fibre_g === 'number' && f.fibre_g > 0, String(f.fibre_g));
  check('butter has saturated fat, and it came through', typeof f.saturated_fat_g === 'number' && f.saturated_fat_g > 0, String(f.saturated_fat_g));
  check(
    'each is a number or null, never a string or NaN',
    [f.saturated_fat_g, f.sugar_g, f.fibre_g].every((v) => v === null || Number.isFinite(v)),
    JSON.stringify([f.saturated_fat_g, f.sugar_g, f.fibre_g])
  );
}

{
  const w = await parse('black coffee');
  const f = w.food_logs[0] ?? {};
  console.log(`\n  "black coffee"\n    sat fat: ${f.saturated_fat_g}  sugar: ${f.sugar_g}  fibre: ${f.fibre_g}`);
  check('a genuine none may be zero; an unknown must be null', f.fibre_g === null || f.fibre_g === 0, String(f.fibre_g));
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
