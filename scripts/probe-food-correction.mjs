// WHY A CORRECTION TO A MEAL SOMETIMES DOES NOTHING.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-food-correction.mjs
//
// Found 14 October 2026 by running Ruth's own examples: correcting a meal she
// had just logged produced no change, no error and no note - on the led chat
// AND on the old one, so it is not last night's work. The route is not the
// problem either: the model asks for the right thing (correctionKind food,
// action update, the meal named) and the app accepts it.
//
// So this calls the update path DIRECTLY, with no route and no model deciding
// anything, on a row it makes itself. If it comes back empty here, the fault is
// inside logFoodFromText and this is the shortest way to see it. It runs the
// same correction several times because the fault is INTERMITTENT - it worked
// once in four attempts through the app, and one green run proves nothing.
//
// Writes only to the test account whose id is given, and deletes its own rows.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = 'file://' + process.cwd().replace(/\\/g, '/');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
// food-logging.ts reads the key at import time.
process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

const { logFoodFromText } = await import(root + '/app/lib/food-logging.ts');

const USER = process.argv[2] ?? '2cc49bec-1c58-442f-a902-19cafb1ea81d';
const RUNS = Number(process.argv[3] ?? 4);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MEAL = 'sourdough crust with peanut butter, 10g chicken breast, herbal tea with slice lime';
const CORRECTION = 'No, literally a crust, like 10g bread, 5g peanut butter';

console.log(`\n  CORRECTING A MEAL, DIRECTLY, ${RUNS} times\n`);

let empty = 0;
for (let i = 1; i <= RUNS; i++) {
  // A row to correct, written the plain way so the starting point is identical
  // every run.
  const { data: made, error: makeError } = await db
    .from('food_logs')
    .insert({
      user_id: USER,
      happened_at: new Date().toISOString(),
      raw_text: MEAL,
      meal_label: 'Snack',
      kcal: 240,
      protein_g: 6,
    })
    .select()
    .single();
  if (makeError) {
    console.log(`  run ${i}: could not make a row to correct - ${makeError.message}`);
    continue;
  }

  let returned = null;
  let threw = null;
  try {
    returned = await logFoodFromText(db, USER, CORRECTION, undefined, String(made.id), MEAL);
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
  }

  const { data: after } = await db
    .from('food_logs')
    .select('id, raw_text, kcal')
    .eq('id', made.id)
    .maybeSingle();

  const changed = after && Number(after.kcal) !== 240;
  if (!returned || returned.length === 0) empty += 1;
  console.log(
    `  run ${i}: returned ${threw ? 'THREW: ' + threw.slice(0, 70) : (returned?.length ?? 0) + ' row(s)'}` +
      `, row is now ${after ? `${after.kcal} kcal "${String(after.raw_text).slice(0, 34)}"` : 'GONE'}` +
      `  ${changed ? 'corrected' : 'UNCHANGED'}`
  );

  await db.from('food_items').delete().eq('food_log_id', made.id);
  await db.from('food_logs').delete().eq('id', made.id);
}

console.log(`\n  ${empty} of ${RUNS} came back with nothing.\n`);
