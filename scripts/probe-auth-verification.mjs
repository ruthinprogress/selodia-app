// Does userIdForRequest accept exactly the right things?
//
// Local JWT verification replaces a call to the Auth server, so the cases that
// matter are the ones that must still be refused. Run before trusting it.

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
process.env.NEXT_PUBLIC_SUPABASE_URL = E.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const { userIdForRequest } = await import('../app/lib/supabase.ts');

const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const DEMO = 'unflumpapp@gmail.com';

async function demoToken() {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: DEMO }),
  }).then((r) => r.json());
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  const session = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  }).then((r) => r.json());
  return session.access_token;
}

const req = (auth) =>
  new NextRequest('https://api.selodia.app/api/ask-selodia', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
  });

const good = await demoToken();
const expectedId = JSON.parse(Buffer.from(good.split('.')[1], 'base64url').toString()).sub;

// Same token, one character of the signature changed.
const parts = good.split('.');
const sig = parts[2];
const flipped = sig[0] === 'A' ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
const tampered = `${parts[0]}.${parts[1]}.${flipped}`;

// Same signature, a different subject claimed.
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
payload.sub = '00000000-0000-0000-0000-000000000000';
const swapped = `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`;

/** @type {[string, string|undefined, string|null][]} */
const cases = [
  ['a real signed-in token', `Bearer ${good}`, expectedId],
  ['no header at all', undefined, null],
  ['empty bearer', 'Bearer ', null],
  ['not a JWT', 'Bearer not-a-token', null],
  ['tampered signature', `Bearer ${tampered}`, null],
  ['someone else claimed as subject', `Bearer ${swapped}`, null],
  ['the project anon key', `Bearer ${ANON}`, null],
  ['the service role key', `Bearer ${SERVICE}`, null],
];

let failed = 0;
for (const [name, header, expected] of cases) {
  const t0 = performance.now();
  let got = null;
  try {
    got = await userIdForRequest(req(header));
  } catch (err) {
    got = `threw: ${err instanceof Error ? err.message : String(err)}`;
  }
  const ok = got === expected;
  if (!ok) failed++;
  const took = `${Math.round(performance.now() - t0)}ms`.padStart(7);
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${took}  ${name}`);
  if (!ok) console.log(`          expected ${expected}, got ${got}`);
}

// The point of the change: the second call must not touch the network.
const t1 = performance.now();
await userIdForRequest(req(`Bearer ${good}`));
const warm = performance.now() - t1;
console.log(`\n  warm verification: ${Math.round(warm)}ms`);

console.log(failed === 0 ? '\n  all cases pass\n' : `\n  ${failed} FAILED\n`);
process.exit(failed === 0 ? 0 : 1);
