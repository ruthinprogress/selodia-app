// THE LIBRARY'S REAL HOME (Ruth, 22 September 2026).
//
// Her Dropbox team trial ended and the renewal was £172.80 a year - "pretty
// much most of the way to how much i paid for the animations, plus costs are
// adding up already and i have no income". The survey found out why it was
// full, and it was not the library being big:
//
//   127.9 GB  the vendor's bundle, a SHARED folder added to her Dropbox
//   137.9 GB  her own backup, which is a copy of that same shared folder
//   265.8 GB  total, for one library held twice in one account
//
// TWO FACTS MAKE THE WHOLE PROBLEM GO AWAY.
//
// A shared folder only counts against your storage once you ADD it. Read by
// its NAMESPACE instead of by its path, the same folder is fully readable and
// costs nothing - proved on live data before any of this was written, by
// listing the bundle and downloading a file from it that way. So the vendor's
// 127.9 GB can leave her Dropbox and still be the source of new releases.
//
// And Backblaze B2 keeps the whole 138 GB for about 66p a month, against
// £14.40 for the Dropbox that was only ever holding a second copy.
//
// So: Dropbox becomes an inbox, B2 becomes the library, Supabase keeps serving
// the clips the app actually shows. Nothing is ever downloaded by hand, which
// was the requirement: "I want a system that I can automate entirely, not
// downloading folders ever, all automated, all remote."
//
// THIS SCRIPT NEVER DELETES ANYTHING, in either place. It copies what is
// missing and leaves everything else alone. Deleting her Dropbox copy is a
// separate decision she makes once she has seen the mirror land, and her
// standing rule is that her files are not touched without confirmation.
//
// RESUME BY SKIPPING. A file already in the bucket at the same size is not
// fetched again, so the job is safe to re-run and simply finishes what it
// started. That matters at 20,600 files: something will always time out, and
// the answer has to be "run it again", never "start over".
//
// Env: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN,
//      B2_KEY_ID, B2_APP_KEY, B2_BUCKET
// Usage:
//   node scripts/mirror-library.mjs --source vendor            (the whole bundle)
//   node scripts/mirror-library.mjs --source vendor --folder "VERTICAL VIDEOS"
//   node scripts/mirror-library.mjs --source backup --folder "Superseded by vendor re-release"
//   ... --dry-run   to see what would be copied and nothing else

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const dryRun = args.includes('--dry-run');
const source = flag('--source', 'vendor');
const onlyFolder = flag('--folder');
const limit = Number(flag('--limit', '0')) || 0;

// The vendor's shared bundle, addressed by namespace so it works whether or not
// the folder is sitting in her Dropbox. This id came from the folder's own
// metadata; it does not change when the folder is added or removed.
const VENDOR_NAMESPACE = '13764084707';
const BACKUP_PATH = '/Selodia Team Folder';

const E = { ...process.env };
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] ||= line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
for (const k of ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN', 'B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET']) {
  if (!E[k]) {
    console.error(`Missing ${k}. See docs/library-mirror.md for where each one comes from.`);
    process.exit(1);
  }
}

// --- Dropbox ---------------------------------------------------------------

// Non-ASCII in a Dropbox header argument has to be escaped. String.raw, because
// a backslash-u written any other way through a script has bitten this project
// three times.
const headerArg = (o) =>
  JSON.stringify(o).replace(/[\u007f-\uffff]/g, (c) => String.raw`\u` + c.charCodeAt(0).toString(16).padStart(4, '0'));

async function dropbox() {
  const t = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: E.DROPBOX_REFRESH_TOKEN,
      client_id: E.DROPBOX_APP_KEY,
      client_secret: E.DROPBOX_APP_SECRET,
    }),
  });
  if (!t.ok) throw new Error(`Dropbox token refresh failed (${t.status})`);
  const auth = `Bearer ${(await t.json()).access_token}`;

  const call = async (endpoint, body, extra = {}) => {
    const r = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: auth, ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...extra },
      body: body === null ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${endpoint} ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  };

  const members = await call('team/members/list_v2', { limit: 100 });
  const sel = { 'Dropbox-API-Select-User': members.members[0].profile.team_member_id };

  // Two ways of addressing the same account: her own files by path, and the
  // vendor's shared bundle by namespace.
  const account = await call('users/get_current_account', null, sel);
  const ownRoot = {
    'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: account.root_info.root_namespace_id }),
    ...sel,
  };
  const vendorRoot = {
    'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'namespace_id', namespace_id: VENDOR_NAMESPACE }),
    ...sel,
  };

  return {
    async list(root, at) {
      let page = await call('files/list_folder', { path: at, recursive: true, limit: 2000 }, root);
      const out = page.entries.filter((e) => e['.tag'] === 'file');
      while (page.has_more) {
        page = await call('files/list_folder/continue', { cursor: page.cursor }, root);
        out.push(...page.entries.filter((e) => e['.tag'] === 'file'));
      }
      return out;
    },
    async downloadTo(root, dropboxPath, file) {
      const r = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { Authorization: auth, ...root, 'Dropbox-API-Arg': headerArg({ path: dropboxPath }) },
      });
      if (!r.ok) throw new Error(`download ${r.status}: ${(await r.text()).slice(0, 200)}`);
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file));
    },
    ownRoot,
    vendorRoot,
  };
}

// --- Backblaze B2 ----------------------------------------------------------
//
// B2's own API rather than the S3-compatible one: no request signing to get
// wrong, and no SDK to install on a runner.

async function backblaze() {
  const basic = Buffer.from(`${E.B2_KEY_ID}:${E.B2_APP_KEY}`).toString('base64');
  const a = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!a.ok) throw new Error(`B2 authorize failed (${a.status}): ${(await a.text()).slice(0, 200)}`);
  const auth = await a.json();
  const storage = auth.apiInfo.storageApi;
  const apiUrl = storage.apiUrl;
  const token = auth.authorizationToken;

  // A KEY RESTRICTED TO ONE BUCKET - which is what the setup page tells her to
  // make, so it is the normal case - cannot call b2_list_buckets at all. The
  // login response names the bucket it is allowed, so that is used when it is
  // there and the list is only asked for when the key is account-wide.
  let found = storage.bucketId ? { bucketId: storage.bucketId, bucketName: storage.bucketName } : null;
  if (found && found.bucketName !== E.B2_BUCKET) {
    throw new Error(`This key is restricted to the bucket "${found.bucketName}", but B2_BUCKET says "${E.B2_BUCKET}".`);
  }
  if (!found) {
    const buckets = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets?accountId=${auth.accountId}`, {
      headers: { Authorization: token },
    });
    found = (await buckets.json()).buckets?.find((b) => b.bucketName === E.B2_BUCKET);
  }
  if (!found) throw new Error(`No B2 bucket called "${E.B2_BUCKET}" on this account.`);

  return {
    /** Every file already there, as name -> size, so a re-run can skip them. */
    async existing(prefix) {
      const have = new Map();
      let startFileName = null;
      for (;;) {
        const r = await fetch(`${apiUrl}/b2api/v3/b2_list_file_names`, {
          method: 'POST',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucketId: found.bucketId, prefix, maxFileCount: 10000, startFileName }),
        });
        if (!r.ok) throw new Error(`b2_list_file_names ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const page = await r.json();
        for (const f of page.files) have.set(f.fileName, f.contentLength);
        if (!page.nextFileName) break;
        startFileName = page.nextFileName;
      }
      return have;
    },

    async upload(name, file, size) {
      const up = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: found.bucketId }),
      });
      if (!up.ok) throw new Error(`b2_get_upload_url ${up.status}`);
      const { uploadUrl, authorizationToken } = await up.json();

      // B2 wants the SHA1 up front, which also means a corrupted transfer is
      // rejected rather than quietly stored.
      const sha1 = await new Promise((resolve, reject) => {
        const h = crypto.createHash('sha1');
        fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
      });

      const r = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(name),
          'Content-Type': 'b2/x-auto',
          'Content-Length': String(size),
          'X-Bz-Content-Sha1': sha1,
        },
        body: Readable.toWeb(fs.createReadStream(file)),
        duplex: 'half',
      });
      if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
    },
  };
}

// --- the mirror ------------------------------------------------------------

// B2 stores a single file up to 5 GB without splitting it into parts. Nothing
// in this library comes near that, so a file that does is reported rather than
// silently skipped - it would mean the vendor has started shipping something
// new, which is worth knowing about.
const SINGLE_FILE_LIMIT = 5_000_000_000;

const dbx = await dropbox();
const b2 = await backblaze();

const root = source === 'vendor' ? dbx.vendorRoot : dbx.ownRoot;
const base = source === 'vendor' ? '' : BACKUP_PATH;
const at = onlyFolder ? `${base}/${onlyFolder}` : base;
const prefix = source === 'vendor' ? 'library/' : 'backup/';

console.log(`Mirroring ${source}${onlyFolder ? ` · ${onlyFolder}` : ''} -> b2:${E.B2_BUCKET}/${prefix}`);
if (dryRun) console.log('DRY RUN - nothing will be uploaded.\n');

const files = await dbx.list(root, at);
console.log(`${files.length} files in Dropbox`);

const have = await b2.existing(prefix + (onlyFolder ? `${onlyFolder}/` : ''));
console.log(`${have.size} already in B2\n`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-'));
let copied = 0;
let skipped = 0;
let bytes = 0;
const problems = [];

for (const f of files) {
  // The path inside the bundle, with the base stripped, so the structure in B2
  // is the structure she sees in Dropbox.
  const rel = f.path_display.replace(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`, 'i'), '');
  const name = prefix + rel.split('/').map((s) => s).join('/');

  if (have.get(name) === f.size) {
    skipped += 1;
    continue;
  }
  if (f.size > SINGLE_FILE_LIMIT) {
    problems.push(`${rel} is ${(f.size / 1e9).toFixed(1)} GB, larger than a single B2 upload allows`);
    continue;
  }
  if (limit && copied >= limit) break;

  if (dryRun) {
    console.log(`  would copy  ${rel}`);
    copied += 1;
    continue;
  }

  const local = path.join(tmp, 'file.bin');
  try {
    await dbx.downloadTo(root, f.path_lower, local);
    await b2.upload(name, local, f.size);
    copied += 1;
    bytes += f.size;
    if (copied % 25 === 0) console.log(`  ${copied} copied · ${(bytes / 1e9).toFixed(2)} GB`);
  } catch (err) {
    // ONE BAD FILE MUST NOT END THE RUN. It is reported and the mirror carries
    // on; the next run picks it up, because a file that did not land is simply
    // a file that is still missing.
    problems.push(`${rel}: ${err instanceof Error ? err.message : err}`);
  } finally {
    fs.rmSync(local, { force: true });
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nDone. ${copied} copied (${(bytes / 1e9).toFixed(2)} GB), ${skipped} already there.`);
if (problems.length > 0) {
  console.log(`\n${problems.length} did not copy this run:`);
  for (const p of problems.slice(0, 40)) console.log('  -', p);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
  console.log('\nRun the job again: anything already copied is skipped.');
}

// A non-zero exit only when nothing at all worked, so a handful of retryable
// failures do not turn a good run into a red cross on the run page.
if (copied === 0 && problems.length > 0) process.exit(1);
