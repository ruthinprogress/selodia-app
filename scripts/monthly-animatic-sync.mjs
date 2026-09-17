// The monthly Exercise Animatic job. Runs on the 17th from GitHub Actions
// (.github/workflows/monthly-animatic-sync.yml), or by hand. Nobody has to touch
// anything (Ruth, 2026-09-17: "The library should grow automatically every month
// without me touching anything").
//
//   1. BACKUP. Compare the vendor's shared folder with Selodia Team Folder. Every
//      file that is new, male or female, any format, is copied across on
//      Dropbox's own servers. A file the vendor has REPLACED has its old version
//      moved to "Superseded by vendor re-release/<date> versions" first, so
//      nothing is ever lost.
//   2. PROCESS. The new and replaced FEMALE VERTICAL clips are downloaded, with
//      the vendor's metadata sheet, and handed to process-animatic-release.mjs:
//      recolour, label from name and sheet only, upload, re-link saved plans.
//      Replaced clips overwrite the version users see (Ruth, 2026-09-17: the
//      re-releases "all look the same to me").
//   3. REPORT. A summary for the GitHub run page, and a non-zero exit on any
//      error, which GitHub emails to the repository owner.
//
// No clip or frame is ever sent to a model (Exercise Animatic ToS 8.3).
//
// Env: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN,
//      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Usage: node scripts/monthly-animatic-sync.mjs [--dry-run]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const VENDOR = '/Ruth Christianson-Monroy/ULTIMATE BUNDLE MASTER FOLDER 4K+1080p+ILLUSTRATIONS+EXERCISE CATALOG (1)';
const BACKUP = '/Selodia Team Folder';
// The backup's green screen folder kept its original name when the vendor renamed
// theirs from 1200+ to 1500+. Mapped rather than duplicated as a second folder.
const toBackupRel = (rel) => rel.replace(/^1500\+ GREEN SCREEN VIDEOS\//i, '1200+ GREEN SCREEN VIDEOS/');
const today = new Date().toISOString().slice(0, 10);
const SUPERSEDED = `${BACKUP}/Superseded by vendor re-release/${today} versions`;
const METADATA_NAME = '2000+ EXERCISE METADATA.xlsx';

// --- env ---------------------------------------------------------------------
const E = { ...process.env };
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] ||= line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
for (const k of ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN']) {
  if (!E[k]) {
    console.error(`Missing ${k}.`);
    process.exit(1);
  }
}

// --- Dropbox ---------------------------------------------------------------------
// The app holds team scopes, so every call names the member it acts as. The team
// has one member; if that ever changes, the member is chosen by the configured
// email rather than by position.
async function dropbox() {
  const t = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${E.DROPBOX_APP_KEY}:${E.DROPBOX_APP_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: E.DROPBOX_REFRESH_TOKEN }),
  });
  if (!t.ok) throw new Error(`Dropbox token refresh failed (${t.status})`);
  const auth = 'Bearer ' + (await t.json()).access_token;

  const call = async (endpoint, body, extra = {}) => {
    const r = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      // No Content-Type on a bodiless call: Dropbox answers a JSON header with no
      // JSON body with a 500 rather than a 400.
      headers: { Authorization: auth, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${endpoint} ${r.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };

  const { members } = await call('team/members/list_v2', { limit: 50 });
  const want = (E.DROPBOX_MEMBER_EMAIL || '').toLowerCase();
  const member = (want && members.find((m) => m.profile.email.toLowerCase() === want)) || members[0];
  const selectUser = { 'Dropbox-API-Select-User': member.profile.team_member_id };
  const account = await call('users/get_current_account', undefined, selectUser);
  const headers = {
    ...selectUser,
    'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: account.root_info.root_namespace_id }),
  };

  const api = (endpoint, body) => call(endpoint, body, headers);
  const listAll = async (p) => {
    const out = [];
    let j = await api('files/list_folder', { path: p, recursive: true, limit: 2000 });
    out.push(...j.entries);
    while (j.has_more) {
      j = await api('files/list_folder/continue', { cursor: j.cursor });
      out.push(...j.entries);
    }
    return out.filter((e) => e['.tag'] === 'file');
  };
  const batch = async (kind, entries) => {
    const failures = [];
    for (let i = 0; i < entries.length; i += 500) {
      const chunk = entries.slice(i, i + 500);
      let j = await api(`files/${kind}_batch_v2`, { entries: chunk, autorename: false });
      const id = j.async_job_id;
      while (j['.tag'] !== 'complete' && j['.tag'] !== 'failed') {
        await new Promise((r) => setTimeout(r, 3000));
        j = await api(`files/${kind}_batch/check_v2`, { async_job_id: id });
      }
      if (j['.tag'] === 'failed') throw new Error(`${kind} batch failed`);
      j.entries.forEach((e, k) => e['.tag'] !== 'success' && failures.push(chunk[k].to_path));
    }
    return failures;
  };
  const download = async (p, dest) => {
    const r = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { Authorization: auth, ...headers, 'Dropbox-API-Arg': JSON.stringify({ path: p }).replace(/[-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) },
    });
    if (!r.ok) throw new Error(`download ${r.status}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  };
  return { listAll, batch, download };
}

const summary = [];
const errors = [];
const say = (line) => {
  console.log(line);
  summary.push(line);
};

const dbx = await dropbox();
const [vendor, backup] = await Promise.all([dbx.listAll(VENDOR), dbx.listAll(BACKUP)]);
const relOf = (f, root) => f.path_display.slice(root.length + 1);
const backupByRel = new Map(backup.map((f) => [relOf(f, BACKUP).toLowerCase(), f]));

const added = [];
const replaced = [];
for (const f of vendor) {
  const rel = relOf(f, VENDOR);
  const b = backupByRel.get(toBackupRel(rel).toLowerCase());
  if (!b) added.push(rel);
  else if (b.size !== f.size) replaced.push(rel);
}
say(`## Exercise Animatic monthly sync, ${today}`);
say(`Vendor library: ${vendor.length} files. New since last month: ${added.length}. Replaced by the vendor: ${replaced.length}.`);

if (dryRun) {
  say('Dry run: nothing copied, moved or processed.');
  process.exit(0);
}

// --- 1. backup -------------------------------------------------------------------
if (replaced.length) {
  const moveFails = await dbx.batch('move', replaced.map((rel) => ({ from_path: `${BACKUP}/${toBackupRel(rel)}`, to_path: `${SUPERSEDED}/${toBackupRel(rel)}` })));
  if (moveFails.length) errors.push(`${moveFails.length} old versions could not be moved to Superseded`);
}
const toCopy = [...added, ...replaced];
if (toCopy.length) {
  const copyFails = await dbx.batch('copy', toCopy.map((rel) => ({ from_path: `${VENDOR}/${rel}`, to_path: `${BACKUP}/${toBackupRel(rel)}` })));
  if (copyFails.length) errors.push(`${copyFails.length} files could not be copied to the backup`);
  say(`Backup: ${toCopy.length - copyFails.length} files copied into Selodia Team Folder${replaced.length ? `, ${replaced.length} earlier versions kept in Superseded` : ''}.`);
} else {
  say('Backup: already up to date.');
}

// --- 2. process female vertical clips ------------------------------------------------
const clipRel = (rel) => /^VERTICAL VIDEOS\/[^/]+\/[^/]+_female(_\d+)?\.mp4$/i.test(rel);
const newClips = added.filter(clipRel);
const changedClips = replaced.filter(clipRel);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'animatic-'));

async function runBatch(rels, label, replace) {
  if (!rels.length) return;
  const src = path.join(work, label);
  for (const rel of rels) {
    try {
      await dbx.download(`${VENDOR}/${rel}`, path.join(src, rel.replace(/^VERTICAL VIDEOS\//, '')));
    } catch (e) {
      errors.push(`download ${rel}: ${e.message}`);
    }
  }
  const metadata = path.join(work, METADATA_NAME);
  if (!fs.existsSync(metadata)) await dbx.download(`${VENDOR}/${METADATA_NAME}`, metadata);
  const args = ['scripts/process-animatic-release.mjs', '--src', src, '--metadata', metadata, '--out', path.join(work, `${label}-recoloured`)];
  if (replace) args.push('--replace');
  try {
    const out = execFileSync('node', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const lines = out.split(/\r?\n/).filter((l) => /added|re-linked|have muscles|errors/.test(l));
    say(`${label === 'new' ? 'New clips' : 'Replaced clips'}: ${rels.length}. ${lines.map((l) => l.trim()).join(' ')}`);
  } catch (e) {
    errors.push(`processing ${label} clips failed: ${String(e.stdout || e.message).slice(-400)}`);
  }
}

await runBatch(newClips, 'new', false);
await runBatch(changedClips, 'replaced', true);
if (!newClips.length && !changedClips.length) say('App library: no new or replaced female vertical clips this month.');

if (errors.length) {
  say(`\n### ${errors.length} problems`);
  errors.forEach((e) => say(`- ${e}`));
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
process.exitCode = errors.length ? 1 : 0;
