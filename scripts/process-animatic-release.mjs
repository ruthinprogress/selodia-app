// Add a batch of new Exercise Animatic clips to Selodía's movement library.
//
// One command, end to end, for a folder of the vendor's VERTICAL female clips
// laid out as <Group>/<Clip>_Female.mp4 with the vendor's metadata sheet beside
// them. It is what the monthly job runs, and what was run by hand for the
// 17 September 2026 release.
//
//   1. RECOLOUR each clip with the locked treatment (sha256 aded0bbd...), the
//      same geometry as recolour-batch.sh: union crop, 4:5 slot, cream margin.
//   2. LABEL it from its name, folder and the vendor sheet only
//      (scripts/lib/animatic-labels.mjs). No clip or frame goes to any model.
//   3. UPLOAD it to the private movement-demos bucket and write its
//      movement_assets row in the same step, human_verified = false.
//   4. RE-LINK every saved plan (public.reresolve_plan_demo_refs), so plans
//      waiting for a clip pick it up.
//
// Every new clip becomes a library item whether or not a plan uses it yet
// (Ruth, 2026-09-17: "the library should grow automatically").
//
// Resumable and non-destructive: a recoloured file that exists is reused, a row
// whose join_key already exists is left alone unless --replace is given, and
// nothing is ever deleted.
//
// Usage:
//   node scripts/process-animatic-release.mjs --src <dir> --metadata <xlsx>
//        [--out <dir>] [--dry-run] [--replace]

import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

import { indexVendorRows, labelClip } from './lib/animatic-labels.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const SRC = arg('--src');
const METADATA = arg('--metadata');
const OUT = arg('--out', path.join(SRC ?? '.', '..', 'recoloured'));
const dryRun = process.argv.includes('--dry-run');
const replace = process.argv.includes('--replace');
const LUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'assets', 'selodia-recolour-locked.cube');
const BUCKET = 'movement-demos';

if (!SRC || !METADATA) {
  console.error('  Need --src <folder of Group/Clip_Female.mp4> and --metadata <vendor xlsx>.');
  process.exit(1);
}

// --- credentials, read from the environment or .env.local, never printed ------
function env() {
  const out = { ...process.env };
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      out[k] ||= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}
const E = env();
const URL_ = E.NEXT_PUBLIC_SUPABASE_URL || E.SUPABASE_URL;
const KEY = E.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('  Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });

// --- what is in the batch -------------------------------------------------------
const clips = [];
for (const group of fs.readdirSync(SRC)) {
  const dir = path.join(SRC, group);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    // Female only, strictly (21 August decision). An unmarked clip is not assumed.
    if (/_female(_\d+)?\.mp4$/i.test(f)) clips.push({ group, file: path.join(dir, f), clip: f.replace(/\.mp4$/i, '') });
  }
}

const sheet = XLSX.readFile(METADATA);
const vendorIndex = indexVendorRows(XLSX.utils.sheet_to_json(sheet.Sheets[sheet.SheetNames[0]]));

const planned = clips.map((c) => ({
  ...c,
  storage_path: `${c.group}/${c.clip}.mp4`,
  out: path.join(OUT, c.group, `${c.clip}.mp4`),
  row: { ...labelClip({ clip: c.clip, folder: c.group, vendorIndex }), storage_path: `${c.group}/${c.clip}.mp4` },
}));

const { data: existingRows, error: exErr } = await supabase.from('movement_assets').select('join_key');
if (exErr) throw new Error(exErr.message);
const existing = new Set(existingRows.map((r) => r.join_key));
const todo = planned.filter((p) => replace || !existing.has(p.row.join_key));

const byPattern = {};
for (const p of todo) byPattern[p.row.movement_pattern] = (byPattern[p.row.movement_pattern] ?? 0) + 1;
console.log(`\n  ${planned.length} female clips in the batch`);
console.log(`  ${planned.length - todo.length} already in the library${replace ? ' (replacing)' : ', skipped'}`);
console.log(`  ${todo.length} to add`);
console.log(`  ${todo.filter((p) => p.row.primary_muscles.length > 0).length} have muscles from the vendor sheet; the rest have none yet`);
console.log('  patterns:', JSON.stringify(byPattern));

if (dryRun) {
  todo.slice(0, 8).forEach((p) =>
    console.log(`    ${p.row.join_key} | ${p.row.movement_pattern} | ${p.row.primary_muscles.join(',')} | ${p.row.equipment}`)
  );
  console.log('\n  --dry-run: nothing written.');
} else {
  await run();
}

async function run() {

// --- 1. recolour ------------------------------------------------------------------
// Identical treatment to recolour-batch.sh, whose comments record why each number
// is what it is (crop threshold 16, the 8% safety net measured per clip, pad
// colour matching the LUT's background). Run from the LUT's own folder because
// ffmpeg's filter parser cannot take a Windows drive path in lut3d.
const SLOT_W = 1080, SLOT_H = 1350, INNER_W = 1015, INNER_H = 1269;
const lutDir = path.dirname(LUT);
const lutName = path.basename(LUT);

function recolour(src, dst) {
  if (fs.existsSync(dst) && fs.statSync(dst).size > 0) return 'reused';
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  let crop = '';
  // Pass 1: the union bounding box. cropdetect reports on stderr. Retried because
  // the source can come back short on a streamed drive; an empty answer three
  // times running falls back to the full frame below.
  let m = null;
  for (let attempt = 0; attempt < 3 && !m; attempt++) {
    const probe = spawnCapture('ffmpeg', ['-nostdin', '-v', 'info', '-i', src, '-vf', 'negate,cropdetect=limit=16:round=2:reset=0', '-f', 'null', '-']);
    m = [...probe.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop() ?? null;
  }
  const dims = spawnCapture('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', src]).trim();
  const [sw, sh] = dims.split('x').map(Number);
  const W = sw || 1080, H = sh || 1920;
  if (!m) crop = `crop=${W}:${H}:0:0`;
  else {
    const [cw, ch] = [Number(m[1]), Number(m[2])];
    crop = cw * ch < (W * H * 8) / 100 ? `crop=${W}:${H}:0:0` : m[0];
  }
  const vf = `${crop},lut3d=file=${lutName},scale=${INNER_W}:${INNER_H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${SLOT_W}:${SLOT_H}:(ow-iw)/2:(oh-ih)/2:color=0xF7F3EA`;
  execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', src, '-vf', vf, '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', dst], { cwd: lutDir, stdio: ['ignore', 'ignore', 'pipe'] });
  return 'encoded';
}

function spawnCapture(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: lutDir, maxBuffer: 64 * 1024 * 1024 });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
}

const errors = [];
let encoded = 0, reused = 0;
for (const [i, p] of todo.entries()) {
  try {
    const how = recolour(path.resolve(p.file), path.resolve(p.out));
    how === 'encoded' ? encoded++ : reused++;
  } catch (e) {
    errors.push(`recolour ${p.storage_path}: ${e.message.split('\n')[0]}`);
  }
  if ((i + 1) % 10 === 0 || i + 1 === todo.length) process.stdout.write(`\r  recoloured ${i + 1}/${todo.length}`);
}
console.log(`\n  encoded ${encoded}, reused ${reused}`);

// --- 2 & 3. upload and record, together ---------------------------------------------
let uploaded = 0;
for (const p of todo) {
  if (!fs.existsSync(p.out)) continue;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(p.storage_path, fs.readFileSync(p.out), { contentType: 'video/mp4', upsert: true });
  if (upErr) { errors.push(`upload ${p.storage_path}: ${upErr.message}`); continue; }
  const { error: dbErr } = await supabase.from('movement_assets').upsert(p.row, { onConflict: 'join_key' });
  if (dbErr) { errors.push(`row ${p.storage_path}: ${dbErr.message}`); continue; }
  uploaded++;
  if (uploaded % 10 === 0 || uploaded === todo.length) process.stdout.write(`\r  uploaded ${uploaded}/${todo.length}`);
}

// --- 4. re-link saved plans -----------------------------------------------------------
const { data: relinked, error: rpcErr } = await supabase.rpc('reresolve_plan_demo_refs');
if (rpcErr) errors.push(`re-link plans: ${rpcErr.message}`);

const { count } = await supabase.from('movement_assets').select('*', { count: 'exact', head: true });
console.log(`\n\n  added ${uploaded} to the library, which now holds ${count}`);
console.log(`  saved plans re-linked: ${rpcErr ? 'FAILED' : relinked}`);
if (errors.length) {
  console.log(`\n  ${errors.length} errors:`);
  errors.slice(0, 20).forEach((e) => console.log('    ' + e));
  process.exitCode = 1;
}
}
