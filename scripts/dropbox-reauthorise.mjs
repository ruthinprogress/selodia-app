// RE-AUTHORISE DROPBOX, ONCE, WITHOUT A TERMINAL.
//
// Run by double-clicking Reauthorise Dropbox.cmd. Ruth's standing rule: a step
// she has to do by hand gets a double-click and a browser page, never a command
// line.
//
// WHY THIS EXISTS AND WHY IT IS NOT A WEEKLY CHORE. The scripts already hold a
// REFRESH token, not an access token, and a Dropbox refresh token does not
// expire. It is exchanged for a fresh access token on every run. That design is
// already the right one and nothing about it needs replacing.
//
// WHAT WENT WRONG ON 8 OCTOBER 2026 was not expiry. The refresh token exchanged
// perfectly - HTTP 200, a valid access token came back - and then every file
// call made as the team member returned 401. Listing team MEMBERS worked;
// listing their FILES did not. That is the signature of an app whose granted
// scopes no longer cover file access, which a new token only fixes once the
// scopes are ticked in the app console first.
//
// SO THE ORDER MATTERS, and getting it wrong wastes the trip:
//
//   1. Tick the scopes at dropbox.com/developers/apps, on the Permissions tab,
//      and press Submit there. Scopes added after a token is minted are NOT in
//      that token.
//   2. Then run this, which mints a new refresh token carrying them.
//
// IT WRITES ONE LINE OF .env.local AND TOUCHES NOTHING ELSE. The old value is
// replaced in place; every other line is left exactly as it was.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV = path.join(ROOT, '.env.local');
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;

/** The permissions these scripts actually use, so the page can list them. */
const SCOPES = [
  'account_info.read',
  'files.metadata.read',
  'files.content.read',
  'members.read',
  'team_data.member',
];

function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV)) return out;
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) {
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function writeRefreshToken(value) {
  const raw = fs.readFileSync(ENV, 'utf8');
  const lines = raw.split(/\r?\n/);
  let replaced = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('DROPBOX_REFRESH_TOKEN=')) {
      lines[i] = `DROPBOX_REFRESH_TOKEN=${value}`;
      replaced = true;
      break;
    }
  }
  if (!replaced) lines.push(`DROPBOX_REFRESH_TOKEN=${value}`);
  fs.writeFileSync(ENV, lines.join('\n'), 'utf8');
  return replaced;
}

function page(title, body) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#F7F2EC;color:#3A342E;
      margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
 .card{max-width:560px;background:#fff;border-radius:18px;padding:32px 36px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
 h1{font-size:22px;margin:0 0 14px}
 p{line-height:1.6;margin:0 0 12px}
 code{background:#F2EBE3;padding:2px 6px;border-radius:6px;font-size:13px}
 .ok{color:#3E7A54}.bad{color:#B4493C}
</style><div class="card"><h1>${title}</h1>${body}</div>`;
}

const env = readEnv();
if (!env.DROPBOX_APP_KEY || !env.DROPBOX_APP_SECRET) {
  console.log('\n  DROPBOX_APP_KEY or DROPBOX_APP_SECRET is missing from .env.local.');
  console.log('  Nothing can be authorised without them. Stopping.\n');
  process.exit(1);
}

const authUrl =
  'https://www.dropbox.com/oauth2/authorize?' +
  new URLSearchParams({
    client_id: env.DROPBOX_APP_KEY,
    response_type: 'code',
    // offline is what mints a REFRESH token rather than a short-lived one.
    token_access_type: 'offline',
    redirect_uri: REDIRECT,
  });

console.log('\n  Opening Dropbox in your browser.');
console.log('  Approve it there and this will finish on its own.\n');
console.log('  If nothing opens, copy this WHOLE line into your browser:\n');
console.log(`  ${authUrl}\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get('code');
  const denied = url.searchParams.get('error');

  if (denied) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Not connected', `<p class="bad">Dropbox said: ${denied}</p><p>Nothing was changed. You can close this and run it again.</p>`));
    console.log(`  Declined: ${denied}. Nothing written.`);
    server.close();
    return;
  }
  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Waiting', '<p>Waiting for Dropbox. You can close this tab if you have already finished.</p>'));
    return;
  }

  const r = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + Buffer.from(`${env.DROPBOX_APP_KEY}:${env.DROPBOX_APP_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT }),
  });
  const data = await r.json();

  if (!r.ok || !data.refresh_token) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      page(
        'Something went wrong',
        `<p class="bad">Dropbox returned: ${String(data.error_description || data.error || r.status)}</p>
         <p>Nothing was written. Your old settings are untouched.</p>`
      )
    );
    console.log(`  FAILED: ${JSON.stringify(data).slice(0, 200)}. Nothing written.`);
    server.close();
    return;
  }

  const replaced = writeRefreshToken(data.refresh_token);
  const granted = String(data.scope || '').split(' ').filter(Boolean);
  const missing = SCOPES.filter((s) => granted.length > 0 && !granted.includes(s));

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(
    page(
      'Dropbox is connected',
      `<p class="ok">Done. The new key is saved in <code>.env.local</code>${replaced ? '' : ' (added, there was none before)'}.</p>
       ${
         missing.length > 0
           ? `<p class="bad">These permissions were <strong>not</strong> granted: <code>${missing.join('</code> <code>')}</code>.</p>
              <p>Tick them on the app's Permissions tab at dropbox.com/developers/apps, press Submit there, then run this again. Scopes added after a key is made are not in that key.</p>`
           : '<p>All the permissions these scripts need were granted.</p>'
       }
       <p>You can close this tab.</p>`
    )
  );

  console.log(`  Saved a new refresh token to .env.local.`);
  if (granted.length > 0) console.log(`  Granted: ${granted.join(', ')}`);
  if (missing.length > 0) console.log(`  STILL MISSING: ${missing.join(', ')}`);
  console.log('');
  server.close();
});

server.listen(PORT, () => {
  // NOT `cmd /c start`, WHICH EATS THE URL (8 October 2026).
  //
  // An OAuth URL is nothing but ampersands, and `&` is how cmd separates one
  // command from the next. `start "" https://...?a=1&b=2` opens the address up
  // to the first one and tries to RUN the rest. Dropbox answered with
  // "Unexpected response_type request param value", which reads like the script
  // asked for the wrong thing and actually means it was never asked properly.
  //
  // rundll32's FileProtocolHandler takes the whole thing as a single argument
  // and hands it to the default browser untouched.
  spawn('rundll32', ['url.dll,FileProtocolHandler', authUrl], {
    detached: true,
    stdio: 'ignore',
  }).unref();
});
