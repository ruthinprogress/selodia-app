// Would the hybrid food lookup actually save anything, on real logs?
//
// Run this before switching FOOD_LOOKUP_TIERS on, and again whenever there are
// more logs or more people. It answers three questions and nothing else:
//
//   1. What share of entries are ONE WEIGHED FOOD - the only shape tier 2 can
//      honestly answer?
//   2. What share of descriptions REPEAT - the only case tier 1 can answer?
//   3. Of those repeats, how many are actually a food, and do their stored
//      calories agree? A repeat whose calories disagree is a cache that would
//      have been wrong.
//
// It reads and prints; it writes nothing and calls no paid API. Open Food Facts
// is only contacted with --network, and then politely, one request at a time.
//
//   npx tsx scripts/measure-food-lookup.mjs <export.json>
//   npx tsx scripts/measure-food-lookup.mjs <export.json> --network
//
// The export is an array of { raw_text, kcal, protein_g }, produced with a
// select from food_logs. This script deliberately holds no database credentials
// of its own, and the export is deliberately not kept in the repository.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isSingleWeighedFood,
  normaliseFoodName,
} from '../app/lib/food-lookup/normalise.ts';
import { isCacheable } from '../app/lib/food-lookup/cache.ts';
import { lookupWeighedEntry } from '../app/lib/food-lookup/open-food-facts.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
// A path may be given, and should be: an export of somebody's food log is health
// data and does not belong in the repository. Keep it outside, pass it in.
const given = process.argv.find((a) => a.endsWith('.json'));
const source = given ?? path.join(here, 'data', 'food-logs.json');

if (!fs.existsSync(source)) {
  console.log(`\n  No export found at ${source}.`);
  console.log('  Export food_logs as [{ raw_text, kcal, protein_g }] and run again.\n');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(source, 'utf8'));
const pct = (n) => `${Math.round((1000 * n) / entries.length) / 10}%`;

console.log(`\n  ${entries.length} entries\n`);

// ---- tier 2: one weighed food ---------------------------------------------
const weighed = entries.filter((e) => isSingleWeighedFood(e.raw_text ?? ''));
console.log('  TIER 2 - ONE WEIGHED FOOD');
console.log(`    ${weighed.length} of ${entries.length}  (${pct(weighed.length)})`);
for (const e of weighed.slice(0, 8)) console.log(`      ${e.raw_text}`);

// ---- tier 1: repeats -------------------------------------------------------
const byKey = new Map();
for (const e of entries) {
  const key = normaliseFoodName(e.raw_text ?? '');
  if (!key) continue;
  const list = byKey.get(key) ?? [];
  list.push(e);
  byKey.set(key, list);
}
const repeated = [...byKey.entries()].filter(([, list]) => list.length > 1);
const repeatCount = repeated.reduce((sum, [, list]) => sum + list.length - 1, 0);

console.log('\n  TIER 1 - REPEATED DESCRIPTIONS');
console.log(`    ${repeatCount} of ${entries.length} entries repeat an earlier one  (${pct(repeatCount)})`);

let unsafe = 0;
for (const [key, list] of repeated) {
  const kcals = list.map((e) => Number(e.kcal ?? 0));
  const spread = Math.max(...kcals) - Math.min(...kcals);
  const cacheable = isCacheable(key);
  if (!cacheable || spread > 0) unsafe += list.length - 1;
  console.log(
    `      ${list.length}x  ${cacheable ? ' ' : '!'} ${key.slice(0, 54)}` +
      `   kcal ${Math.min(...kcals)}-${Math.max(...kcals)}${spread > 0 ? '  <- disagree' : ''}`
  );
}
console.log(
  `\n    Of those repeats, ${unsafe} would have been answered WRONGLY or are refused as placeholders.`
);

// ---- what Open Food Facts would actually say -------------------------------
if (process.argv.includes('--network')) {
  console.log('\n  OPEN FOOD FACTS, ON THE WEIGHED ENTRIES\n');
  for (const e of weighed) {
    // One at a time, with a pause: their terms ask callers not to hammer it.
    const found = await lookupWeighedEntry(e.raw_text);
    await new Promise((r) => setTimeout(r, 1200));
    if (!found) {
      console.log(`    no confident match   ${e.raw_text}`);
      continue;
    }
    const stored = Number(e.kcal ?? 0);
    const diff = stored > 0 ? Math.round((100 * (found.kcal - stored)) / stored) : null;
    console.log(
      `    ${e.raw_text}\n      stored ${stored} kcal | OFF ${found.kcal} kcal` +
        `${diff == null ? '' : ` (${diff > 0 ? '+' : ''}${diff}%)`}  as "${found.matchedName}"`
    );
  }
}

console.log('\n  The switch is FOOD_LOOKUP_TIERS=on. Leave it off unless these numbers justify it.\n');
