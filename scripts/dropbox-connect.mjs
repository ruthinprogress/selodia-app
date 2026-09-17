// Connect the "Selodia Library Sync" Dropbox app, once.
//
// Run by Ruth in her own terminal, never by Claude: it asks for the app key and
// secret, opens Dropbox's approval page, and swaps the code Dropbox shows for a
// long-lived refresh token. All three are written to .env.local, which git
// ignores. Nothing is printed except whether it worked.
//
// The monthly library job then uses the refresh token to get a short-lived
// access token each time it runs, so nobody has to log in again.
//
// Usage:  node scripts/dropbox-connect.mjs

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { exec } from 'node:child_process';

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log('\n  Connect Selodia Library Sync to Dropbox\n');
console.log('  Find these on the app\'s Settings tab at dropbox.com/developers/apps.');
console.log('  Paste them here, in this terminal only. Never into a chat.\n');

const appKey = (await rl.question('  App key: ')).trim();
const appSecret = (await rl.question('  App secret: ')).trim();
if (!appKey || !appSecret) {
  console.log('\n  Both are needed. Nothing was saved.');
  process.exit(1);
}

const authUrl =
  'https://www.dropbox.com/oauth2/authorize' +
  `?client_id=${encodeURIComponent(appKey)}` +
  '&response_type=code&token_access_type=offline';

console.log('\n  Opening Dropbox in your browser. Click Allow, then copy the code it shows.');
console.log('  If nothing opens, paste this address into your browser:\n');
console.log('  ' + authUrl + '\n');
exec(`start "" "${authUrl}"`);

const code = (await rl.question('  Code from Dropbox: ')).trim();
rl.close();

const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: 'Basic ' + Buffer.from(`${appKey}:${appSecret}`).toString('base64'),
  },
  body: new URLSearchParams({ code, grant_type: 'authorization_code' }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok || !data.refresh_token) {
  console.log(`\n  Dropbox said no (${res.status}). The code only works once and expires quickly.`);
  console.log('  Run this again and use a fresh code. Nothing was saved.');
  process.exit(1);
}

// Replace any earlier values rather than stacking duplicates.
const envPath = path.join(process.cwd(), '.env.local');
const keep = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => !/^DROPBOX_(APP_KEY|APP_SECRET|REFRESH_TOKEN)=/.test(l))
  : [];
while (keep.length && keep[keep.length - 1] === '') keep.pop();
keep.push(`DROPBOX_APP_KEY=${appKey}`, `DROPBOX_APP_SECRET=${appSecret}`, `DROPBOX_REFRESH_TOKEN=${data.refresh_token}`, '');
fs.writeFileSync(envPath, keep.join('\n'));

console.log('\n  Connected. Saved to .env.local. You can close this window and tell Claude it worked.\n');
