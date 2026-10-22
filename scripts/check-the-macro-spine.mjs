// ONE FACT, NINE PLACES THAT HAVE TO AGREE ABOUT IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-macro-spine.mjs
//
// Ruth, 22 October 2026, after the third session running where the bug was
// never in the logic: "how do we prevent that happening again?"
//
// THE HONEST DIAGNOSIS. Adding one nutrient to this app means editing nine
// places, each correct on its own and none of them aware of the others:
//
//   1. MACROS                      the phone's list of what can be shown
//   2. MACRO_COLUMN                the server's list, for the chat
//   3. ParsedMacros / ParsedItem   the parse types
//   4. FOOD_PARSE_JSON_SCHEMA      twice - once for the log, once per item
//   5. the parse instruction       how to estimate it
//   6. buildFoodLogFields          storing it on the log
//   7. writeItems                  storing it on each item
//   8. the totals sum              adding items up into the log
//   9. MACRO_COLUMNS               fetching it back out again
//
// Adding calcium and iron, I got six of the nine right and shipped. She
// reported it three times across two days - once for the server's list, once
// for the fetch on the log, and once more for the fetch on the items - and
// every time the pipeline was "fine" in the sense that each piece worked.
//
// WHY THE EXISTING CHECKS DID NOT HELP. There were plenty, and they were good.
// They tested whether code COMPUTES correctly. Every one of these bugs was
// about whether two places AGREE, and nothing was looking at the seams.
//
// SO THIS CHECK IS THE SPINE. MACROS is the one source; every other place is
// asserted against it. Add a tenth nutrient and this fails nine times with the
// nine file names, before it ever reaches her screen.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { MACROS, MACRO_COLUMNS } = await import(here('mobile/src/lib/tracked-macros.ts'));
const { MACRO_COLUMN } = await import(here('app/lib/tracked-macro-summary.ts'));

let pass = 0;
const failures = [];
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const prompt = fs.readFileSync('app/lib/food-parse-prompt.ts', 'utf8');
const writing = fs.readFileSync('app/lib/food-logging.ts', 'utf8');

// Calories and protein are always shown and are not optional, so they are
// absent from the server's optional-macro table by design. Everything else
// about them is identical.
const OPTIONAL_ONLY = new Set(['kcal', 'protein']);

console.log('\n  THE MACRO SPINE\n');

await check('EVERY MACRO IS ASKED FOR BY THE PARSER', () => {
  const missing = [];
  for (const m of MACROS) {
    // On the log AND on each item: a total with no items behind it cannot be
    // broken down afterwards, and the breakdown card would show a blank column.
    const inSchema = [...prompt.matchAll(new RegExp(`"${m.column}": number`, 'g'))].length;
    if (inSchema !== 2) missing.push(`${m.key}: in the JSON schema ${inSchema} times, not 2`);
    if (!new RegExp(`${m.column}\\?: number`).test(prompt)) {
      missing.push(`${m.key}: missing from the parsed types`);
    }
  }
  assert.deepStrictEqual(missing, [], missing.join(' | '));
  return `${MACROS.length} macros, log and item`;
});

await check('AND STORED ON THE LOG, ON EACH ITEM, AND SUMMED', () => {
  // The three writes in food-logging.ts. Iron reached none of them until it
  // was added by hand, and nothing would have said so.
  const missing = [];
  for (const m of MACROS) {
    const c = m.column;
    if (!new RegExp(`${c}:\\s*macros\\.${c}`).test(writing)) missing.push(`${m.key}: not stored on the log`);
    if (!new RegExp(`${c}:\\s*it\\.${c}`).test(writing)) missing.push(`${m.key}: not stored on its item`);
    if (!new RegExp(`${c}:\\s*sum\\(`).test(writing)) missing.push(`${m.key}: not summed from the items`);
  }
  assert.deepStrictEqual(missing, [], missing.join(' | '));
  return 'log, item, total';
});

await check('AND FETCHED BACK OUT AGAIN', () => {
  // The fault she reported twice on 22 October: parsed, stored, and never
  // selected, so it read as "nobody worked it out" on every screen.
  const missing = MACROS.filter((m) => !MACRO_COLUMNS.includes(m.column)).map((m) => m.key);
  assert.deepStrictEqual(missing, [], `never fetched: ${missing.join(', ')}`);
  return MACRO_COLUMNS;
});

await check('AND KNOWN TO THE CHAT', () => {
  // The server filters what she switched on against its own table, so a macro
  // missing here is dropped in silence and the chat says her record does not
  // keep it. That has now happened four times with four different fields.
  const missing = MACROS.filter(
    (m) => !OPTIONAL_ONLY.has(m.key) && !(m.key in MACRO_COLUMN)
  ).map((m) => m.key);
  assert.deepStrictEqual(missing, [], `the chat cannot see: ${missing.join(', ')}`);
  return `${Object.keys(MACRO_COLUMN).length} optional macros`;
});

await check('AND TOLD HOW TO ESTIMATE ITSELF', () => {
  // A column the model is never told how to fill comes back empty forever,
  // which is iron's whole history: asked for in the schema from today, and
  // 0% populated across 360 items until the instruction was written.
  // THE COLUMN NAME, NOT THE DISPLAY LABEL. The first version of this asserted
  // the label - "Calories", "Carbohydrates", "Salt" - and failed on all three,
  // because the parser's words are kcal, carbs_g and sodium_mg. The label is
  // what SHE reads; the column is what the model is told.
  //
  // Anchoring on the wrong one of two names that must agree is precisely the
  // fault this file was written to catch, committed inside the file that
  // catches it. Left here as the comment rather than quietly corrected.
  //
  // Two mentions is the JSON schema alone - once for the log, once per item.
  // Anything above that is prose: what it is, where it comes from, when to
  // leave it out.
  const missing = [];
  for (const m of MACROS) {
    const mentions = [...prompt.matchAll(new RegExp(m.column, 'g'))].length;
    if (mentions <= 2) missing.push(`${m.key} (${mentions} mentions, schema only)`);
  }
  assert.deepStrictEqual(missing, [], `declared but never explained: ${missing.join(', ')}`);
  return 'each one explained, not just declared';
});

await check('AND HAS A COLUMN ON BOTH TABLES', async () => {
  // The one place the code cannot be its own source, so it is read from the
  // live database. Skipped rather than failed without credentials, because a
  // check nobody can run locally is a check that gets commented out.
  const env = {};
  try {
    for (const raw of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const line = raw.trim();
      const i = line.indexOf('=');
      if (i > 0 && !line.startsWith('#')) {
        env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    return 'skipped: no .env.local';
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) {
    return 'skipped: no service key';
  }

  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ASKING FOR THE COLUMNS IS THE TEST. PostgREST refuses a select naming one
  // that does not exist, which is exactly the failure a new macro would hit on
  // its first real write - except here it happens on this machine instead of
  // on her phone.
  // ONLY A MISSING COLUMN IS A FAILURE. Postgres answers 42703 - "column
  // food_logs.magnesium_mg does not exist" - and that is the thing worth
  // blocking a push for. An unreachable database answers with an empty code
  // and "TypeError: fetch failed", which means the laptop is on a train, not
  // that the schema is wrong.
  //
  // THE FIRST VERSION OF THIS TREATED THEM THE SAME, so a dropped connection
  // would have turned the whole suite red and stopped work for a reason that
  // had nothing to do with the code. A check that cries wolf offline is a
  // check somebody eventually comments out, and then it is guarding nothing.
  const missing = [];
  for (const table of ['food_logs', 'food_items']) {
    const { error } = await db.from(table).select(MACRO_COLUMNS).limit(1);
    if (!error) continue;
    if (error.code === '42703') missing.push(`${table}: ${error.message}`);
    else return `skipped: could not reach the database (${error.code || 'no code'})`;
  }
  assert.deepStrictEqual(missing, [], missing.join(' | '));
  return 'food_logs and food_items both hold all ten';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
