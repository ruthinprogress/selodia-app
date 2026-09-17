// A copy-button page for adding the monthly job's secrets to GitHub.
//
// Started by double-clicking github-secrets.cmd. Serves a page to this laptop only
// (127.0.0.1) with each secret's NAME and a Copy button for its VALUE, read from
// .env.local, beside a link to GitHub's "New secret" form. The values are never
// printed, never shown on the page, and never pass through chat. The page closes
// itself after 30 minutes.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { exec } from 'node:child_process';

const PORT = 53683;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const NEW_SECRET = 'https://github.com/ruthinprogress/selodia-app/settings/secrets/actions/new';
const NAMES = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rows = NAMES.map((n, i) => `
  <li>
    <div class="num">${i + 1}</div>
    <div class="body">
      <a class="btn ghost" href="${NEW_SECRET}" target="_blank">Open GitHub's new secret form</a>
      <div class="field"><span class="label">Name</span><code>${n}</code><button onclick="copy(this, '${n}')">Copy name</button></div>
      <div class="field"><span class="label">Secret</span><span class="hidden">hidden</span>${
        env[n] ? `<button onclick="copy(this, document.getElementById('v${i}').value)">Copy secret</button><input type="hidden" id="v${i}" value="${esc(env[n])}">` : '<span class="missing">not found on this laptop</span>'
      }</div>
      <div class="hint">Paste both into GitHub, click <b>Add secret</b>, then come back for the next one.</div>
    </div>
  </li>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub secrets</title><style>
body{font-family:system-ui,sans-serif;background:#F7F2E9;color:#2D2B28;margin:0}
main{max-width:640px;margin:40px auto;padding:0 20px}
h1{font-size:26px;font-weight:600;margin:0 0 8px} p{line-height:1.5}
ol{list-style:none;padding:0;display:grid;gap:16px}
li{display:flex;gap:14px;background:#fff;border-radius:12px;padding:16px}
.num{font-weight:700;color:#C97458;font-size:20px;min-width:20px}
.body{display:grid;gap:10px;flex:1}
.field{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.label{width:56px;color:#7A6F63;font-size:14px}
code{background:#F1E9DC;padding:4px 8px;border-radius:6px}
button,.btn{font-size:15px;padding:8px 14px;border:0;border-radius:8px;background:#C97458;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
.ghost{background:#E9D6C2;color:#2D2B28;justify-self:start}
.hidden{color:#7A6F63;font-style:italic}.missing{color:#A4452C}
.hint{color:#7A6F63;font-size:14px}
</style></head><body><main>
<h1>Add the monthly job's keys to GitHub</h1>
<p>Five secrets, one at a time. The values are copied straight to your clipboard and never shown. If GitHub asks you to sign in or confirm your password, do that first.</p>
<ol>${rows}</ol>
<p>When all five are added, tell Claude.</p>
</main><script>
function copy(btn, text){navigator.clipboard.writeText(text).then(function(){var t=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=t},1500)})}
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url !== '/') {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  A page has opened in your browser. Leave this window open while you use it.');
  console.log('  It closes by itself after 30 minutes.\n');
  exec(`start "" "http://127.0.0.1:${PORT}/"`);
});
setTimeout(() => process.exit(0), 30 * 60 * 1000);
