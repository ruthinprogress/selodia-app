// Connect the "Selodia Library Sync" Dropbox app, once.
//
// Started by double-clicking connect-dropbox.cmd in the project folder. It opens
// a small page in the browser, served only to this laptop (127.0.0.1), because
// pasting into PowerShell did not work for Ruth and typing keys by hand is not
// a reasonable ask. Everything is pasted into ordinary web boxes instead.
//
// The app key, secret and the resulting refresh token are written to .env.local,
// which git ignores. Nothing is printed, logged or sent anywhere except to
// Dropbox itself. Claude never runs this and never sees the values.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { exec } from 'node:child_process';

const PORT = 53682;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const ENV_PATH = path.join(ROOT, '.env.local');

const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Dropbox</title>
<style>
  body { font-family: system-ui, sans-serif; background: #F7F2E9; color: #2D2B28; margin: 0; }
  main { max-width: 560px; margin: 48px auto; padding: 0 20px; }
  h1 { font-weight: 600; font-size: 26px; margin: 0 0 8px; }
  p { line-height: 1.5; }
  label { display: block; font-weight: 600; margin: 22px 0 6px; }
  input { width: 100%; box-sizing: border-box; font-size: 16px; padding: 12px; border: 1px solid #C9B9A6; border-radius: 10px; background: #fff; }
  button, .btn { display: inline-block; margin-top: 22px; font-size: 16px; padding: 12px 20px; border: 0; border-radius: 10px; background: #C97458; color: #fff; cursor: pointer; text-decoration: none; }
  .step { color: #7A6F63; font-size: 14px; margin-top: 4px; }
  .ok { background: #D9E8DF; padding: 16px; border-radius: 10px; }
  .bad { background: #F4D9D0; padding: 16px; border-radius: 10px; }
</style></head><body><main>${body}</main></body></html>`;

const form = page(`
<h1>Connect Dropbox</h1>
<p>Paste into these boxes as normal. Nothing here leaves your laptop except to Dropbox.</p>
<form method="post" action="/connect">
  <label for="k">1. App key</label>
  <div class="step">dropbox.com/developers/apps, Selodia Library Sync, Settings tab, "App key"</div>
  <input id="k" name="key" autocomplete="off" required>

  <label for="s">2. App secret</label>
  <div class="step">Same page, "App secret", click Show first</div>
  <input id="s" name="secret" autocomplete="off" required>

  <label>3. Get the code</label>
  <div class="step">Click this after filling in the app key. A Dropbox tab opens: click Continue, then Allow, then copy the code it shows.</div>
  <a class="btn" href="#" onclick="var k=document.getElementById('k').value.trim(); if(!k){alert('Paste the app key first.');return false;} window.open('https://www.dropbox.com/oauth2/authorize?client_id='+encodeURIComponent(k)+'&response_type=code&token_access_type=offline','_blank'); return false;">Open Dropbox</a>

  <label for="c">4. Code from Dropbox</label>
  <input id="c" name="code" autocomplete="off" required>

  <button type="submit">Connect</button>
</form>`);

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(new URLSearchParams(data)));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(form);
  }
  if (req.method === 'POST' && req.url === '/connect') {
    const body = await readBody(req);
    const key = (body.get('key') ?? '').trim();
    const secret = (body.get('secret') ?? '').trim();
    const code = (body.get('code') ?? '').trim();

    const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'),
      },
      body: new URLSearchParams({ code, grant_type: 'authorization_code' }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (!r || !r.ok || !data.refresh_token) {
      return res.end(page(`<h1>Not connected yet</h1>
<p class="bad">Dropbox didn't accept that. The code only works once and expires after a few minutes, so this is usually just a stale code.</p>
<a class="btn" href="/">Try again</a>`));
    }

    const keep = fs.existsSync(ENV_PATH)
      ? fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/).filter((l) => !/^DROPBOX_(APP_KEY|APP_SECRET|REFRESH_TOKEN)=/.test(l))
      : [];
    while (keep.length && keep[keep.length - 1] === '') keep.pop();
    keep.push(`DROPBOX_APP_KEY=${key}`, `DROPBOX_APP_SECRET=${secret}`, `DROPBOX_REFRESH_TOKEN=${data.refresh_token}`, '');
    fs.writeFileSync(ENV_PATH, keep.join('\n'));

    res.end(page(`<h1>Connected</h1>
<p class="ok">Dropbox is connected and saved on this laptop. You can close this tab and the black window, and tell Claude it worked.</p>`));
    setTimeout(() => process.exit(0), 500);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  A page has opened in your browser. Follow the steps there.');
  console.log('  Leave this window open until the page says Connected.\n');
  exec(`start "" "http://127.0.0.1:${PORT}/"`);
});
