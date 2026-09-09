// Upload the 770 recoloured movement demonstrations, and record each one.
//
// The object and its database row are written in the same step, deliberately. If
// they were two passes, a partial run would leave rows pointing at objects that
// are not there - and the symptom of that is an exercise whose demo silently
// shows nothing, which is exactly the failure that is hardest to notice.
//
// Resumable: it lists what the bucket already has and skips those, so an
// interrupted run is restarted by running it again. Nothing is deleted.
//
// LICENCE NOTE. The bucket is private and must stay private (Exercise Animatic
// ToS 8.4 - end users may not be allowed to download or extract the files). This
// script uses the service role, which is the only thing that should ever write
// here. Clips reach the app as short-lived signed URLs minted server-side.
//
// Usage:  node scripts/upload-movement-demos.mjs [--dry-run] [--limit N]

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE =
  'H:/My Drive/Selodia App Project Master Folder/Build Specs/Excersise Animatics/Recoloured 4x5 female vertical';
const MANIFEST =
  'H:/My Drive/Selodia App Project Master Folder/Build Specs/Excersise Animatics/movement-classification.json';
const BUCKET = 'movement-demos';
const CONCURRENCY = 6;

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

// --- credentials, read from disk and never printed -------------------------
function env() {
  const out = {};
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      out[t.slice(0, i).trim()] ||= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const E = env();
const URL = E.NEXT_PUBLIC_SUPABASE_URL || E.SUPABASE_URL;
const KEY = E.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error(
    '\n  Missing credentials.\n' +
      '  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
      '  The service role key is at:\n' +
      '    Supabase dashboard -> Project Settings -> API Keys -> service_role\n' +
      '  It bypasses RLS. Server-side only, never in the mobile app, never committed.\n'
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// --- what we intend to write ------------------------------------------------
const rows = JSON.parse(fs.readFileSync(MANIFEST, 'utf8').replace(/^\uFEFF/, ''));
const splitList = (v) => (v || '').split(';').map((s) => s.trim()).filter(Boolean);

const planned = rows.map((r) => ({
  storage_path: `${r.vendor_folder}/${r.clip}.mp4`,
  local: path.join(SOURCE, r.vendor_folder, `${r.clip}.mp4`),
  row: {
    join_key: r.join_key,
    clip: r.clip,
    storage_path: `${r.vendor_folder}/${r.clip}.mp4`,
    muscle_group: r.vendor_folder,
    primary_muscles: splitList(r.primary_muscles),
    secondary_muscles: splitList(r.secondary_muscles),
    equipment: r.equipment || null,
    movement_pattern: r.movement_pattern,
    human_verified: !!r.human_verified,
    ai_confidence: r.ai_confidence || null,
  },
}));

const absent = planned.filter((p) => !fs.existsSync(p.local));
if (absent.length) {
  console.error(`  ${absent.length} manifest rows have no file. First: ${absent[0].local}`);
  process.exit(1);
}

// --- skip what is already uploaded, so a broken run is just re-run ----------
async function alreadyThere() {
  const seen = new Set();
  const folders = [...new Set(planned.map((p) => p.storage_path.split('/')[0]))];
  for (const folder of folders) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000, offset });
      if (error) throw new Error(`list ${folder}: ${error.message}`);
      if (!data.length) break;
      for (const f of data) seen.add(`${folder}/${f.name}`);
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return seen;
}

const have = await alreadyThere();
const todo = planned.filter((p) => !have.has(p.storage_path)).slice(0, LIMIT);

const bytes = todo.reduce((n, p) => n + fs.statSync(p.local).size, 0);
console.log(`\n  ${planned.length} clips in the manifest`);
console.log(`  ${have.size} already in the bucket`);
console.log(`  ${todo.length} to upload  (${(bytes / 1e6).toFixed(1)} MB)`);

if (dryRun) {
  console.log('\n  --dry-run: nothing written.');
  todo.slice(0, 5).forEach((p) => console.log('    would upload ' + p.storage_path));
  process.exit(0);
}

// --- upload, then record ----------------------------------------------------
let done = 0;
let failed = 0;
const errors = [];

async function one(p) {
  const body = fs.readFileSync(p.local);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(p.storage_path, body, { contentType: 'video/mp4', upsert: true });
  if (upErr) {
    failed++;
    errors.push(`${p.storage_path}: ${upErr.message}`);
    return;
  }
  const { error: dbErr } = await supabase
    .from('movement_assets')
    .upsert(p.row, { onConflict: 'join_key' });
  if (dbErr) {
    failed++;
    errors.push(`${p.storage_path} (row): ${dbErr.message}`);
    return;
  }
  done++;
  if (done % 25 === 0 || done === todo.length) {
    process.stdout.write(`\r  uploaded ${done}/${todo.length}`);
  }
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await one(next);
    }
  })
);

// Rows for clips that were already in the bucket still need to exist - a resumed
// run would otherwise leave the table short by whatever the first run uploaded
// before it died.
const missingRows = planned.filter((p) => have.has(p.storage_path));
if (missingRows.length) {
  for (let i = 0; i < missingRows.length; i += 200) {
    const { error } = await supabase
      .from('movement_assets')
      .upsert(missingRows.slice(i, i + 200).map((p) => p.row), { onConflict: 'join_key' });
    if (error) errors.push(`backfill rows: ${error.message}`);
  }
}

const { count } = await supabase
  .from('movement_assets')
  .select('*', { count: 'exact', head: true });

console.log(`\n\n  uploaded ${done}, failed ${failed}`);
console.log(`  movement_assets rows: ${count}`);
if (errors.length) {
  console.log('\n  errors:');
  errors.slice(0, 20).forEach((e) => console.log('    ' + e));
}
