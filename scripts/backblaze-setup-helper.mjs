// SETTING UP THE LIBRARY'S NEW HOME, WITHOUT A TERMINAL (Ruth, 22 September 2026).
//
// Started by double-clicking backblaze-setup.cmd. Serves a page to this laptop
// only (127.0.0.1) that walks through making a Backblaze account, takes the
// three values it produces, writes them into .env.local, tests that they
// actually work, and then hands over copy buttons for GitHub.
//
// The same shape as github-secrets-helper.mjs and for the same reason: she does
// not get sent to a terminal, and a secret is never printed, never shown back,
// and never passes through chat.
//
// THE TEST IS THE POINT. A key pasted one character short fails silently at 2am
// on a Friday, in a job nobody is watching. This checks the account, finds the
// bucket and reports what it found before she moves on.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { exec } from 'node:child_process';

const PORT = 53684;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const ENV = path.join(ROOT, '.env.local');
const NEW_SECRET = 'https://github.com/ruthinprogress/selodia-app/settings/secrets/actions/new';
const NAMES = ['B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET'];

function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV)) return out;
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Replaces a value in place if the key is already there, appends it if not. */
function writeEnv(values) {
  const lines = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8').split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(values)) {
    const at = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (at >= 0) lines[at] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(ENV, lines.join('\n').replace(/\n+$/, '') + '\n', 'utf8');
}

/** Does this actually work? Answered before she goes near GitHub. */
async function check({ B2_KEY_ID, B2_APP_KEY, B2_BUCKET }) {
  try {
    const basic = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
    const a = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!a.ok) return { ok: false, why: 'Backblaze would not accept that key id and key. Worth making a fresh application key.' };
    const auth = await a.json();
    const apiUrl = auth.apiInfo.storageApi.apiUrl;
    const r = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets?accountId=${auth.accountId}`, {
      headers: { Authorization: auth.authorizationToken },
    });
    const buckets = (await r.json()).buckets ?? [];
    const found = buckets.find((b) => b.bucketName === B2_BUCKET);
    if (!found) {
      return {
        ok: false,
        why: buckets.length
          ? `The key works, but there is no bucket called "${B2_BUCKET}". Buckets on this account: ${buckets.map((b) => b.bucketName).join(', ')}.`
          : 'The key works, but the account has no buckets yet. Make one in step 2.',
      };
    }
    return { ok: true, why: `Connected. Bucket "${found.bucketName}" is ${found.bucketType === 'allPrivate' ? 'private, which is right' : found.bucketType}.` };
  } catch (err) {
    return { ok: false, why: `Could not reach Backblaze: ${err instanceof Error ? err.message : err}` };
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function page({ saved = null, result = null } = {}) {
  const env = readEnv();
  const have = NAMES.every((n) => env[n]);
  const copyRows = NAMES.map(
    (n, i) => `
    <li>
      <div class="num">${i + 1}</div>
      <div class="body">
        <div class="name">${n}</div>
        <button class="btn" data-copy="${esc(env[n] ?? '')}">Copy the value</button>
        <a class="btn ghost" href="${NEW_SECRET}" target="_blank">Open GitHub's new secret form</a>
      </div>
    </li>`
  ).join('');

  return `<!doctype html><meta charset="utf-8"><title>Backblaze setup</title>
<style>
  :root { --cream:#F7F3EA; --sand:#E9D6C2; --ink:#2D2B28; --soft:#605A52; --mark:#C97458; --deep:#874C3A; --line:#C9BFAE; }
  body { background:var(--cream); color:var(--ink); font:16px/1.55 system-ui,-apple-system,sans-serif; margin:0; padding:40px 20px 80px; }
  .page { max-width:720px; margin:0 auto; }
  h1 { font-size:1.9rem; margin:0 0 6px; }
  h2 { font-size:1.15rem; margin:34px 0 10px; }
  p { max-width:60ch; color:var(--soft); }
  ol.steps { padding-left:0; list-style:none; margin:0; }
  ol.steps > li { display:grid; grid-template-columns:auto 1fr; gap:14px; padding:14px 0; border-bottom:1px solid var(--line); }
  .num { width:26px; height:26px; border-radius:99px; background:var(--mark); color:var(--cream); display:grid; place-items:center; font-size:.8rem; }
  .name { font-family:ui-monospace,monospace; font-weight:600; margin-bottom:6px; }
  .btn { font:inherit; font-size:.9rem; background:var(--deep); color:var(--cream); border:0; border-radius:8px; padding:7px 13px; cursor:pointer; text-decoration:none; display:inline-block; margin:2px 4px 2px 0; }
  .btn.ghost { background:transparent; color:var(--deep); border:1px solid var(--line); }
  label { display:block; font-weight:600; margin:14px 0 4px; font-size:.95rem; }
  input { width:100%; font:inherit; padding:9px 11px; border:1px solid var(--line); border-radius:8px; background:#FBF8F2; box-sizing:border-box; }
  .card { background:var(--sand); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }
  .ok { border-left:4px solid #3F5A46; background:#E7EDE2; padding:12px 15px; border-radius:0 10px 10px 0; }
  .bad { border-left:4px solid #A63A2E; background:#F6E4E0; padding:12px 15px; border-radius:0 10px 10px 0; }
  small { color:var(--soft); }
</style>
<div class="page">
  <h1>The library's new home</h1>
  <p>Three things to fetch from Backblaze, then three to paste into GitHub. Ten minutes, all in a browser.
     Nothing you type here leaves this laptop.</p>

  <h2>1 &middot; Make the account</h2>
  <ol class="steps">
    <li><div class="num">a</div><div class="body">
      <a class="btn" href="https://www.backblaze.com/sign-up/cloud-storage" target="_blank">Open Backblaze sign-up</a>
      <div><small>The first 10 GB are free. The whole library is about 66p a month.</small></div>
    </div></li>
    <li><div class="num">b</div><div class="body">
      In <strong>Buckets</strong>, choose <strong>Create a Bucket</strong>. Name it something like
      <code>selodia-library</code> and leave it <strong>Private</strong>.
    </div></li>
    <li><div class="num">c</div><div class="body">
      In <strong>Application Keys</strong>, choose <strong>Add a New Application Key</strong>, allow it access to that
      bucket, and create it.
      <div><small>Backblaze shows the key once and never again, so keep the tab open until you have pasted it below.</small></div>
    </div></li>
  </ol>

  <h2>2 &middot; Paste them here</h2>
  ${result ? `<div class="${result.ok ? 'ok' : 'bad'}">${esc(result.why)}</div>` : ''}
  <form method="POST" action="/save" class="card" style="margin-top:14px">
    <label for="B2_KEY_ID">keyID</label>
    <input id="B2_KEY_ID" name="B2_KEY_ID" autocomplete="off" spellcheck="false" placeholder="005abc..." value="">
    <label for="B2_APP_KEY">applicationKey</label>
    <input id="B2_APP_KEY" name="B2_APP_KEY" autocomplete="off" spellcheck="false" placeholder="K005..." value="">
    <label for="B2_BUCKET">Bucket name</label>
    <input id="B2_BUCKET" name="B2_BUCKET" autocomplete="off" spellcheck="false" placeholder="selodia-library" value="${esc(readEnv().B2_BUCKET ?? '')}">
    <div style="margin-top:16px"><button class="btn" type="submit">Save and test the connection</button></div>
    <div><small>Saved to .env.local on this laptop, the same place the Dropbox keys already live.</small></div>
  </form>

  <h2>3 &middot; Give them to GitHub</h2>
  ${have
      ? `<p>So the weekly job can use them too. Paste each name and value into GitHub's form.</p><ol class="steps">${copyRows}</ol>`
      : `<p><small>This step appears once the three above are saved.</small></p>`}
</div>
<script>
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
      var was = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = was; }, 1200);
    });
  });
</script>`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);
    const values = {};
    for (const n of NAMES) {
      const v = (form.get(n) ?? '').trim();
      // A blank field leaves whatever is already there alone, so coming back to
      // fix one value does not wipe the other two.
      if (v) values[n] = v;
    }
    if (Object.keys(values).length > 0) writeEnv(values);
    const result = await check({ ...readEnv() });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page({ saved: true, result }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page());
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`Setup page open at ${url}`);
  console.log('This window can stay minimised. It closes itself after 30 minutes.');
  exec(`start "" "${url}"`);
});

setTimeout(() => process.exit(0), 30 * 60 * 1000);
