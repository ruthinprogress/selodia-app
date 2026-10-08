// WHY DROPBOX STOPPED ANSWERING, AND WHICH PART IS WRONG.
//
//   node scripts/dropbox-auth-doctor.mjs
//
// Ruth, 8 October 2026: "that's not a system that's going to work if this
// happens weekly - find a better solution."
//
// THE BETTER SOLUTION IS ALREADY THERE, which is the first useful finding. The
// scripts do not hold a Dropbox access token. They hold a REFRESH token and
// exchange it for a fresh access token on every run, which is the design that
// does not expire weekly. A Dropbox refresh token lasts until it is revoked.
//
// SO AN invalid_access_token MEANS SOMETHING MORE SPECIFIC THAN "it expired",
// and there are four things it can mean. They need different fixes and only one
// of them needs her, so the point of this script is to say WHICH rather than
// send her to re-authorise something that was never the problem.
//
// IT READS AND PRINTS NOTHING SECRET. Lengths and first characters only, which
// is enough to tell a missing value from a truncated one without putting a
// credential on screen or in a terminal history.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/ruthi/unflump-app';

const E = {};
const envPath = path.join(ROOT, '.env.local');
if (!fs.existsSync(envPath)) {
  console.log(`\n  .env.local is missing at ${envPath}. Nothing to check.\n`);
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const NEEDED = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN'];

console.log('\n  THE THREE VALUES\n');
let missing = false;
for (const k of NEEDED) {
  const v = E[k];
  if (!v) {
    console.log(`  MISSING  ${k}`);
    missing = true;
  } else {
    console.log(`  present  ${k}  (${v.length} chars, starts "${v.slice(0, 4)}")`);
  }
}

if (missing) {
  console.log('\n  A value is missing from .env.local. Nothing else can be true until that is fixed.\n');
  process.exit(1);
}

console.log('\n  STEP ONE: does the refresh token still buy an access token?\n');

const res = await fetch('https://api.dropbox.com/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization:
      'Basic ' + Buffer.from(`${E.DROPBOX_APP_KEY}:${E.DROPBOX_APP_SECRET}`).toString('base64'),
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: E.DROPBOX_REFRESH_TOKEN,
  }),
});

const body = await res.text();
let parsed = {};
try {
  parsed = JSON.parse(body);
} catch {
  /* left as {} - the raw text is printed below */
}

console.log(`  HTTP ${res.status}`);

if (!res.ok) {
  // THE FOUR THINGS THIS CAN MEAN, named rather than left as an error string.
  const err = String(parsed.error || body).slice(0, 200);
  console.log(`  ${err}\n`);
  if (/invalid_client/.test(err)) {
    console.log('  WHAT IT MEANS: the app key or secret is wrong.');
    console.log('  The refresh token is probably fine. Nothing needs re-authorising.');
    console.log('  FIX: check DROPBOX_APP_KEY and DROPBOX_APP_SECRET against the app');
    console.log('  at dropbox.com/developers/apps. This is a copy-paste fix, not a consent one.');
  } else if (/invalid_grant/.test(err)) {
    console.log('  WHAT IT MEANS: the refresh token has been revoked.');
    console.log('  That happens when the app is disconnected under Dropbox security');
    console.log('  settings, or the app is deleted, or the secret is rotated.');
    console.log('  FIX: this is the one that genuinely needs Ruth, once. See below.');
  } else {
    console.log('  WHAT IT MEANS: not one of the usual two. The raw response is above.');
  }
  console.log('');
  process.exit(1);
}

const token = parsed.access_token;
if (!token) {
  console.log('  The exchange succeeded and returned no access_token, which should not happen.');
  console.log(`  Body: ${body.slice(0, 200)}\n`);
  process.exit(1);
}
console.log(`  Got an access token (${token.length} chars). The refresh token is healthy.\n`);

console.log('  STEP TWO: which member is it acting as?\n');

// A TEAM TOKEN HAS NO SINGLE ACCOUNT, which is what the first version of this
// script got wrong. Calling users/get_current_account bare returns "the token is
// for an entire Dropbox Business team", which reads like an authentication
// failure and is really a wrong-endpoint one. Every file call has to name a
// member with Dropbox-API-Select-User.
const membersRes = await fetch('https://api.dropboxapi.com/2/team/members/list_v2', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 100 }),
});
const membersText = await membersRes.text();
console.log(`  team/members/list_v2  HTTP ${membersRes.status}`);
if (!membersRes.ok) {
  console.log(`  ${membersText.slice(0, 220)}\n`);
  console.log('  WHAT IT MEANS: the app cannot list its own team members, so the');
  console.log('  member-reading permission is missing too. Fix the permissions first.\n');
  process.exit(1);
}
const members = JSON.parse(membersText).members ?? [];
console.log(`  ${members.length} member(s): ${members.map((m) => m.profile.email).join(', ')}\n`);
if (members.length === 0) {
  console.log('  No members, so there is nobody to act as. Stopping.\n');
  process.exit(1);
}
const SELECT = { 'Dropbox-API-Select-User': members[0].profile.team_member_id };

console.log("  STEP THREE: can it read that member's files?\n");

const ls = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...SELECT },
  body: JSON.stringify({ path: '', limit: 5 }),
});
const lsText = await ls.text();
console.log(`  files/list_folder  HTTP ${ls.status}`);

if (ls.ok) {
  const n = (JSON.parse(lsText).entries ?? []).length;
  console.log(`  Listed ${n} entr${n === 1 ? 'y' : 'ies'} at the member's root.`);
  console.log('\n  Dropbox is working. If a script still fails, the fault is in that');
  console.log('  script rather than in the authentication.\n');
  process.exit(0);
}

console.log(`  ${lsText.slice(0, 220)}\n`);
console.log('  WHAT IT MEANS: THE PERMISSIONS, NOT THE KEY.');
console.log('');
console.log('  The refresh token exchanged perfectly in step one, and listing MEMBERS');
console.log('  worked in step two. Only the file call is refused, which is what an app');
console.log('  whose granted scopes no longer cover file access looks like. Dropbox');
console.log('  reports that as invalid_access_token, which reads like expiry and is not.');
console.log('');
console.log('  FIX, AND THE ORDER MATTERS:');
console.log('    1. dropbox.com/developers/apps, open the Selodia app, Permissions tab.');
console.log('       Tick file reading and member reading, then press Submit THERE.');
console.log('    2. Double-click "Reauthorise Dropbox.cmd" in the project folder.');
console.log('');
console.log('  Doing 2 without 1 mints a key with the same gaps and changes nothing:');
console.log('  scopes added after a key is made are not in that key.\n');
process.exit(1);
