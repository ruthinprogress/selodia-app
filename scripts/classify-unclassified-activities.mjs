// FILL IN THE SESSIONS THE FLOWER NEVER SAW.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/classify-unclassified-activities.mjs          (dry run)
//   node --import ./scripts/ts-resolve-hook.mjs scripts/classify-unclassified-activities.mjs --write
//
// `cover_strength` is written in exactly one place in this codebase, from a
// lookup against thirty-one broad activity types. The comments promised a
// classifier for everything else and it was never built, so any activity
// nobody had pre-weighted got six nulls and counted for nothing in the Health
// Flower. In Ruth's record on 21 October 2026 that was 14 of 48 sessions.
//
// classify-activity.ts is that classifier, and it now runs at log time. This
// is for the rows written before it existed.
//
// ONE CALL PER DISTINCT NAME, NOT PER ROW. Three "Full-Body Barbell Strength
// Plan" sessions are one question asked once, and the answer goes into the
// shared dictionary - so this gets cheaper every time anybody runs it, for
// anybody.
//
// DRY BY DEFAULT. It prints what it would write and changes nothing until
// --write, because this is somebody's record of their own body and a wrong
// weighting is worse than a missing one.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const url = E.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = E.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log('\n  Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n');
  process.exit(1);
}

const db = createClient(url, serviceKey);
const anthropic = new Anthropic({ apiKey: E.ANTHROPIC_API_KEY });
const { resolveCoverage, nameKey } = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/classify-activity.ts')).href
);
const { COVER_COLUMN, DIMENSIONS } = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/health-flower-dimensions.ts')).href
);

const write = process.argv.includes('--write');

const { data: rows, error } = await db
  .from('activity_logs')
  .select('id, activity_type')
  .is('cover_strength', null);

if (error) {
  console.log(`\n  could not read the logs: ${error.message}\n`);
  process.exit(1);
}
if (!rows || rows.length === 0) {
  console.log('\n  Nothing unclassified. Every logged session reaches the flower.\n');
  process.exit(0);
}

/** name_key -> the rows wearing that name. */
const byName = new Map();
for (const r of rows) {
  const key = nameKey(r.activity_type ?? '');
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, { name: r.activity_type, ids: [] });
  byName.get(key).ids.push(r.id);
}

console.log(`\n  ${rows.length} unclassified sessions, ${byName.size} distinct names\n`);

let filled = 0;
let gaveUp = 0;
for (const [, { name, ids }] of byName) {
  const cover = await resolveCoverage(db, anthropic, name, null);
  if (!cover) {
    console.log(`  ?  ${name.padEnd(38)} could not be placed - left unclassified`);
    gaveUp += 1;
    continue;
  }
  const shape = DIMENSIONS.map((d) => `${d.slice(0, 4)} ${String(cover[d]).padStart(3)}`).join('  ');
  console.log(`  ${write ? '>' : '.'}  ${name.padEnd(38)} ${shape}   (${ids.length} row${ids.length === 1 ? '' : 's'})`);
  if (!write) continue;
  const patch = {};
  for (const d of DIMENSIONS) patch[COVER_COLUMN[d]] = cover[d];
  const { error: upErr } = await db.from('activity_logs').update(patch).in('id', ids);
  if (upErr) {
    console.log(`     could not write: ${upErr.message}`);
    continue;
  }
  filled += ids.length;
}

console.log(
  write
    ? `\n  ${filled} sessions now reach the flower. ${gaveUp} name(s) could not be placed.\n`
    : `\n  Dry run - nothing written. Re-run with --write to apply.\n`
);
