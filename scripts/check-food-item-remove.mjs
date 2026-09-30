// REMOVING ONE ITEM FROM A MEAL LEAVES THE MEAL TELLING THE TRUTH.
//
//   node scripts/check-food-item-remove.mjs
//
// Ruth, 30 September 2026, item 2d: per-item delete on the food item view.
//
// WHY THIS IS A DATABASE TEST AND NOT A UNIT TEST. The dangerous half of this
// feature is not the swipe, it is the arithmetic: every figure she is shown -
// the food row, the day's line, the week's average, what is left of her targets
// - is read from food_logs, and food_items is a child table nothing sums.
// Delete the chia and the meal still claims its calories. The subtraction lives
// in a Postgres function so it cannot be half-done, and a Postgres function is
// only testable against Postgres.
//
// IT WRITES TO HER DATABASE, WHICH IS WORTH BEING DELIBERATE ABOUT. It creates
// one meal and two items, removes one item, checks the parent, and deletes
// everything it made. Two guards against the run that dies in the middle:
//
//   the meal is dated 1 January 2001, so a leftover can never appear in any
//   week she is looking at, or in any average;
//
//   the marker text below is deleted at the START of every run as well as the
//   end, so a crashed run is cleaned by the next one rather than accumulating.
//
// WHAT IT PROVES, and each of these is a way the feature could be wrong:
//
//   the item is gone;
//   the meal's figures went DOWN BY THAT ITEM and no further;
//   a figure the meal did not have stays unknown rather than becoming zero;
//   the other item is untouched;
//   and the whole thing is one transaction, so the function on a row that does
//   not exist changes nothing at all.

import fs from 'node:fs';
import path from 'node:path';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const URL = E.NEXT_PUBLIC_SUPABASE_URL;
const KEY = E.SUPABASE_SERVICE_ROLE_KEY;
const MARKER = 'CHECK-FOOD-ITEM-REMOVE (delete me)';
const LONG_AGO = '2001-01-01T12:00:00Z';

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function rest(method, pathAndQuery, body) {
  const res = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const failures = [];
let pass = 0;
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}
function eq(actual, expected, what) {
  if (Number(actual) !== Number(expected)) throw new Error(`${what}: expected ${expected}, got ${actual}`);
}

// Anything a previous run left behind.
await rest('DELETE', `food_logs?raw_text=eq.${encodeURIComponent(MARKER)}`);

// Whose account to write on: an existing row's owner, so nothing here has to
// know a user id or reach into auth.
const someone = await rest('GET', 'food_logs?select=user_id&limit=1');
if (!someone?.length) {
  console.error('  SKIPPED  no food_logs row to borrow a user_id from');
  process.exit(0);
}
const userId = someone[0].user_id;

let logId = null;
try {
  // fibre_g is deliberately left null: a meal whose fibre nobody computed.
  const [log] = await rest('POST', 'food_logs', {
    user_id: userId,
    raw_text: MARKER,
    happened_at: LONG_AGO,
    kcal: 500,
    protein_g: 40,
    carbs_g: 50,
    fat_g: 10,
    fibre_g: null,
  });
  logId = log.id;

  const [itemA] = await rest('POST', 'food_items', {
    food_log_id: logId,
    user_id: userId,
    name: 'Check item A',
    quantity: '100g',
    kcal: 200,
    protein_g: 15,
    carbs_g: 20,
    fat_g: 4,
    fibre_g: 3,
  });
  await rest('POST', 'food_items', {
    food_log_id: logId,
    user_id: userId,
    name: 'Check item B',
    quantity: '1',
    kcal: 300,
    protein_g: 25,
  });

  await rest('POST', 'rpc/food_item_remove', { p_item_id: itemA.id });

  const [after] = await rest('GET', `food_logs?id=eq.${logId}&select=kcal,protein_g,carbs_g,fat_g,fibre_g`);
  const left = await rest('GET', `food_items?food_log_id=eq.${logId}&select=id,name,kcal,protein_g`);

  check('the item is gone and the other one is not', () => {
    eq(left.length, 1, 'items remaining');
    if (left[0].name !== 'Check item B') throw new Error(`the wrong item survived: ${left[0].name}`);
    eq(left[0].kcal, 300, "the surviving item's calories");
    eq(left[0].protein_g, 25, "the surviving item's protein");
  });

  check('the meal went down by exactly that item', () => {
    eq(after.kcal, 300, 'kcal');
    eq(after.protein_g, 25, 'protein');
    eq(after.carbs_g, 30, 'carbs');
    eq(after.fat_g, 6, 'fat');
  });

  check('a figure the meal never had stays unknown, not zero', () => {
    if (after.fibre_g !== null) {
      throw new Error(`fibre was null and is now ${after.fibre_g} - null means nobody measured it`);
    }
  });

  check('removing a row that is not there changes nothing', () => {
    // Runs below; this block exists so the name appears in order.
  });
  const before = JSON.stringify(after);
  await rest('POST', 'rpc/food_item_remove', { p_item_id: '00000000-0000-0000-0000-000000000000' });
  const [unchanged] = await rest('GET', `food_logs?id=eq.${logId}&select=kcal,protein_g,carbs_g,fat_g,fibre_g`);
  if (JSON.stringify(unchanged) !== before) {
    failures.push('removing a row that is not there changed the meal');
  }

  // CAN THIS CHECK FAIL? Take the second item away WITHOUT the function - the
  // plain delete the feature must not be built from - and the meal is left
  // claiming calories nothing accounts for. If that state passes the same
  // assertion, the assertion was never testing anything.
  await rest('DELETE', `food_items?id=eq.${left[0].id}`);
  const [naive] = await rest('GET', `food_logs?id=eq.${logId}&select=kcal`);
  const naiveCaught = Number(naive.kcal) !== 0;
  if (!naiveCaught) {
    failures.push('USELESS: a plain delete left the meal at 0 kcal on its own, so the function proves nothing');
  }
  console.log(`  Proof: a plain delete leaves the meal claiming ${naive.kcal} kcal with no items behind it`);
} finally {
  if (logId) await rest('DELETE', `food_logs?id=eq.${logId}`);
  // Belt and braces: the marker again, in case the id was never captured.
  await rest('DELETE', `food_logs?raw_text=eq.${encodeURIComponent(MARKER)}`);
}

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
