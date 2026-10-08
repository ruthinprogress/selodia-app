import fs from 'node:fs';
const E = {};
for (const line of fs.readFileSync('C:/Users/ruthi/unflump-app/.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const REDIRECT = 'http://localhost:53682';
const url =
  'https://www.dropbox.com/oauth2/authorize?' +
  new URLSearchParams({
    client_id: E.DROPBOX_APP_KEY,
    response_type: 'code',
    token_access_type: 'offline',
    redirect_uri: REDIRECT,
  });

const res = await fetch(url, { redirect: 'manual' });
const text = await res.text();
console.log('authorize page HTTP', res.status);
console.log('location:', res.headers.get('location') ?? '(none)');

// Dropbox renders its refusals as visible text on the page.
const flat = text.replace(/\s+/g, ' ');
const hits = [
  'redirect_uri',
  'Invalid redirect',
  'not registered',
  'bad request',
  'Error connecting app',
  'response_type',
  'client_id',
  'does not exist',
  'sign in',
  'Sign in',
];
console.log('\nwhat the page mentions:');
for (const h of hits) {
  const at = flat.indexOf(h);
  if (at >= 0) console.log(`  "${h}"  ->  ...${flat.slice(Math.max(0, at - 90), at + 110)}...`);
}
console.log('\npage length:', text.length);
