// IS `_To process` SAFE TO EMPTY?
//
// It holds 150 files, 385 MB, all dated 17 September. The question is not what
// is in it but whether every clip in it already reached the library, because
// that is the only thing that makes it disposable.
//
// READ ONLY, both ends. It lists Dropbox and reads the movement_assets table.
// Nothing is moved, uploaded or deleted. The deletion, if there is one, is
// Ruth's to make.
//
// Checks EVERY clip rather than a sample. "Five of five matched" is not an
// answer to "can I delete 385 MB", and the one that did not match would be the
// whole point.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/ruthi/unflump-app';
const FOLDER = '/Selodia Team Folder/_To process';

const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

// --- Dropbox -----------------------------------------------------------------
const token = (
  await (
    await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${E.DROPBOX_APP_KEY}:${E.DROPBOX_APP_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: E.DROPBOX_REFRESH_TOKEN }),
    })
  ).json()
).access_token;

const members = await (
  await fetch('https://api.dropboxapi.com/2/team/members/list_v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 100 }),
  })
).json();
const SELECT = { 'Dropbox-API-Select-User': members.members[0].profile.team_member_id };

async function api(endpoint, body, root) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...SELECT };
  if (root) headers['Dropbox-API-Path-Root'] = JSON.stringify(root);
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers,
    body: body === null ? 'null' : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const acct = await api('users/get_current_account', null);
const HOME = { '.tag': 'root', root: acct.root_info.root_namespace_id };

let page = await api('files/list_folder', { path: FOLDER.toLowerCase(), recursive: true, limit: 2000 }, HOME);
const entries = [...page.entries];
while (page.has_more) {
  page = await api('files/list_folder/continue', { cursor: page.cursor }, HOME);
  entries.push(...page.entries);
}
const clips = entries.filter((e) => e['.tag'] === 'file' && /\.mp4$/i.test(e.name));
const others = entries.filter((e) => e['.tag'] === 'file' && !/\.mp4$/i.test(e.name));

// --- the library -------------------------------------------------------------
const res = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/movement_assets?select=clip,storage_path&limit=5000`, {
  headers: { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}` },
});
const assets = await res.json();
const known = new Set();
for (const a of assets) {
  if (a.clip) known.add(String(a.clip).toLowerCase().trim());
  if (a.storage_path) known.add(String(a.storage_path).split('/').pop().replace(/\.mp4$/i, '').toLowerCase().trim());
}

const missing = [];
for (const c of clips) {
  const stem = c.name.replace(/\.mp4$/i, '').toLowerCase().trim();
  if (!known.has(stem)) missing.push(c.name);
}

const mb = (n) => `${(n / 1e6).toFixed(0)} MB`;
const bytes = [...clips, ...others].reduce((n, f) => n + (f.size ?? 0), 0);

console.log('\n  _To process: is it safe to empty?\n');
console.log(`  folder            ${FOLDER}`);
console.log(`  clips             ${clips.length}`);
console.log(`  other files       ${others.length}${others.length ? ' (' + others.map((o) => o.name).join(', ') + ')' : ''}`);
console.log(`  size              ${mb(bytes)}`);
console.log(`  library holds     ${assets.length} clips\n`);

if (missing.length === 0) {
  console.log(`  EVERY ONE of the ${clips.length} clips is already in the library.`);
  console.log('  The folder is a staging copy of the 17 September release and');
  console.log('  holds nothing the app does not already have.\n');
} else {
  console.log(`  ${clips.length - missing.length} of ${clips.length} are in the library. ${missing.length} are NOT:\n`);
  for (const n of missing.slice(0, 30)) console.log(`    ${n}`);
  if (missing.length > 30) console.log(`    ... and ${missing.length - 30} more`);
  console.log('\n  Do not empty it until these are explained.\n');
}

console.log('  Nothing was moved, uploaded or deleted. Emptying it is Ruth\'s call.\n');
