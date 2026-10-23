// WHAT ON THIS MACHINE NEEDS A PAIR OF HANDS, AND WHAT NEVER WILL.
//
//   node scripts/headless-readiness.mjs
//
// WHY THIS EXISTS. Ruth, 23 October 2026, setting up a server she intends never
// to sit in front of again: "how will this be managed on a headless server. The
// whole point is I remain remote forever, once its set up."
//
// It is the right question and it has a single, sharp answer.
//
//   A CREDENTIAL IS EITHER A SESSION OR A TOKEN.
//
//   A SESSION is created by signing in through a browser. It carries an expiry,
//   refreshing it only restarts the same clock, and when it finally lapses the
//   only way back is a browser. On a machine with no screen, that is a locked
//   door. `vercel login` makes one of these. So does `eas login`.
//
//   A TOKEN is a string in a file. It is created once, it can be given no
//   expiry at all, and nothing about it ever needs a person again. It survives
//   reboots, it copies to a new machine, and it does not care that there is no
//   monitor attached.
//
// So the rule for the server is one line: NO SESSIONS, ONLY TOKENS. Everything
// below is this project's credentials sorted into those two piles.
//
// THE COST OF NOT KNOWING, measured on this machine: the Vercel login lapsed
// three times in October. scripts/fix-vercel-login.cmd was written on the 20th
// to replace it with a no-expiry token, and as of the 23rd .env.local had no
// VERCEL_TOKEN in it - so the script existed, the fix was understood, and the
// session kept expiring anyway. The answer was written down and not applied,
// which is a shape this repository has hit before.
//
// THIS IS A REPORT, NOT A GATE, and it is deliberately not named check-*.
// check-all.mjs auto-discovers those, and a check that is red until a migration
// finishes is a check people learn to scroll past.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ENV = '.env.local';

function envKeys() {
  if (!existsSync(ENV)) return new Set();
  const out = new Set();
  for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0 && t.slice(i + 1).trim()) out.add(t.slice(0, i).trim());
  }
  return out;
}

const keys = envKeys();
const has = (k) => keys.has(k) || Boolean(process.env[k]);

// A credential this project actually uses. `token` is what makes it survive a
// headless machine; `session` is the file that proves it is currently relying
// on an interactive login instead.
const CREDENTIALS = [
  {
    what: 'Vercel',
    why: 'reads which deploy is live, so a FAILED build can be seen',
    token: 'VERCEL_TOKEN',
    session: path.join(homedir(), 'AppData', 'Roaming', 'com.vercel.cli', 'auth.json'),
    fix: 'scripts\\fix-vercel-login.cmd  (creates a No Expiration dashboard token)',
  },
  {
    what: 'Expo / EAS',
    why: 'publishes updates to the phone - scripts/publish-update.mjs',
    token: 'EXPO_TOKEN',
    session: path.join(homedir(), '.expo', 'state.json'),
    fix: 'expo.dev > Account Settings > Access Tokens > Create. Put it in .env.local as EXPO_TOKEN.',
  },
  {
    what: 'Anthropic',
    why: 'every chat turn',
    token: 'ANTHROPIC_API_KEY',
    session: null,
    fix: 'console.anthropic.com > API keys',
  },
  {
    what: 'Supabase (service role)',
    why: 'all server-side reads and writes',
    token: 'SUPABASE_SERVICE_ROLE_KEY',
    session: null,
    fix: 'Supabase dashboard > Project Settings > API',
  },
  {
    what: 'ElevenLabs',
    why: 'voice, and the illustration pipeline',
    token: 'ELEVENLABS_API_KEY',
    session: null,
    fix: 'elevenlabs.io, signed in as hello@selodia.app with a PASSWORD, not Google',
  },
  {
    what: 'Dropbox',
    why: 'the animatics library backup',
    token: 'DROPBOX_REFRESH_TOKEN',
    session: null,
    fix: 'a refresh token renews itself and needs no screen',
  },
];

console.log('');
console.log('  HEADLESS READINESS');
console.log('  ==================');
console.log('');
console.log('  A session needs a browser when it lapses. A token never does.');
console.log('');

const needHands = [];

for (const c of CREDENTIALS) {
  const tokenPresent = has(c.token);
  const sessionPresent = Boolean(c.session) && existsSync(c.session);

  let state;
  if (tokenPresent) {
    state = 'TOKEN    ';
  } else if (sessionPresent) {
    state = 'SESSION  ';
    needHands.push(c);
  } else {
    state = 'MISSING  ';
    needHands.push(c);
  }

  console.log(`  ${state} ${c.what}`);
  console.log(`            ${c.why}`);
  if (!tokenPresent && sessionPresent) {
    console.log(`            relying on an interactive login: ${c.session}`);
    console.log(`            this WILL lock you out of a headless machine`);
    console.log(`            fix: ${c.fix}`);
  } else if (!tokenPresent) {
    console.log(`            no ${c.token} and no login found`);
    console.log(`            fix: ${c.fix}`);
  } else {
    console.log(`            ${c.token} is set, so nothing here needs a screen`);
  }
  console.log('');
}

// -- the one that is not a credential at all -------------------------------
//
// Worth its own section because it is the single biggest assumption this
// repository makes about the machine it runs on, and it is invisible until it
// is not there. AGENTS.md: every deliverable goes to H:\My Drive. Thirty-one
// files in this repo name that path.

const DRIVE = path.join('H:', 'My Drive', 'Selodia App Project Master Folder');
const driveThere = existsSync(DRIVE);

console.log(`  ${driveThere ? 'MOUNTED  ' : 'ABSENT   '} Google Drive (H:)`);
console.log('            where every deliverable, spec and log is filed');
if (driveThere) {
  console.log('            present, so the close-out can write');
} else {
  console.log('            NOT PRESENT. Google Drive for Desktop is a desktop app that');
  console.log('            signs in through a browser ONCE at install and then runs as a');
  console.log('            service. Install and sign it in while the new machine still');
  console.log('            has a screen in front of it, or over remote desktop. After');
  console.log('            that it needs nothing. Without it the close-out ceremony');
  console.log('            cannot file anything and will say so rather than guessing.');
}
console.log('');

console.log('  ----------------------------------------------------------------');
if (needHands.length === 0 && driveThere) {
  console.log('  Every credential is a token. Nothing here needs a screen again.');
} else {
  console.log(`  ${needHands.length + (driveThere ? 0 : 1)} thing(s) still need a person, and the time to do them is`);
  console.log('  BEFORE the machine goes headless, not after:');
  for (const c of needHands) console.log(`    - ${c.what}: ${c.fix}`);
  if (!driveThere) console.log('    - Google Drive for Desktop: install and sign in once');
}
console.log('');
console.log('  Never run `vercel login` or `eas login` on the server. Both create');
console.log('  the expiring kind, and both will strand it.');
console.log('');
