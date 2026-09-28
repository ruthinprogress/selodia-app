// DRINK ESTIMATES, AGAINST THE ONE THAT WAS WRONG.
//
// Her half of lager was logged at 180 kcal and 6 g protein. CoFID makes a 284 ml
// half 68 kcal and 0.9 g. This checks the correction gets there, and - which
// matters more - that it leaves alone everything it should.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-drink-composition.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { correctDrinkEstimates } from '../app/lib/drink-composition.ts';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const db = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

async function run(items) {
  return correctDrinkEstimates(db, items);
}

console.log('\n## The one that was wrong\n');
{
  const { items, corrections } = await run([
    { name: 'lager', quantity: 'half', kcal: 180, protein_g: 6 },
    { name: 'lamb pizza', quantity: 'whole', kcal: 2000, protein_g: 72 },
  ]);
  console.log(`  lager:  ${items[0].kcal} kcal, ${items[0].protein_g} g protein`);
  console.log(`  pizza:  ${items[1].kcal} kcal, ${items[1].protein_g} g protein`);
  if (corrections[0]) console.log(`  from ${corrections[0].source}, ${corrections[0].measure}\n`);
  check('the half of lager is about 68 kcal', Math.abs(items[0].kcal - 68) <= 2, `got ${items[0].kcal}`);
  check('its protein is about 0.9 g, not 6', Math.abs(items[0].protein_g - 0.9) <= 0.2, `got ${items[0].protein_g}`);
  check('the pizza is untouched', items[1].kcal === 2000 && items[1].protein_g === 72);
  check('exactly one correction was reported', corrections.length === 1);
}

console.log('\n## Measures she might actually say\n');
for (const [text, expectKcal] of [
  [{ name: 'pint of lager' }, 136],
  [{ name: 'glass of red wine' }, 133],
  [{ name: 'gin and tonic', quantity: 'single' }, 56],
  [{ name: 'prosecco', quantity: 'a glass' }, 105],
  [{ name: 'Guinness', quantity: 'a pint' }, 210],
]) {
  const { items } = await run([text]);
  const got = items[0].kcal;
  check(`${text.name}${text.quantity ? ', ' + text.quantity : ''}`, got != null && Math.abs(got - expectKcal) <= expectKcal * 0.2, `${got} kcal`);
}

console.log('\n## What it must NOT touch\n');
for (const item of [
  { name: 'beer-battered cod', kcal: 450, protein_g: 30 },
  { name: 'red wine sauce', kcal: 90, protein_g: 1 },
  { name: 'chicken salad', kcal: 445, protein_g: 34 },
  { name: 'black coffee', kcal: 2, protein_g: 0 },
]) {
  const before = { ...item };
  const { items, corrections } = await run([item]);
  check(`${item.name} is left alone`, items[0].kcal === before.kcal && corrections.length === 0);
}

console.log('\n## And an estimate that was already right is not rewritten\n');
{
  const { corrections } = await run([{ name: 'lager', quantity: 'half', kcal: 68, protein_g: 0.9 }]);
  check('no correction reported', corrections.length === 0);
}

console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
