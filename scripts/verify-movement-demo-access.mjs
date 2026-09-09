// Prove the whole delivery chain, not just that the file uploaded.
//
// Three things have to be true, and each fails differently:
//   1. a signed URL for a private object actually plays
//   2. the SAME path without a signature does NOT - that is the licence clause
//   3. an expired signature stops working
//
// Point 2 is the one worth testing. A bucket that is private in the dashboard but
// serves objects to anyone with the path would satisfy nobody's reading of ToS 8.4.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  E[t.slice(0, i).trim()] ||= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const URL_ = E.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: rows } = await admin
  .from('movement_assets')
  .select('join_key, clip, storage_path')
  .limit(1);
const asset = rows[0];
console.log(`  testing: ${asset.storage_path}`);

// 1. signed URL plays
const { data: signed, error } = await admin.storage
  .from('movement-demos')
  .createSignedUrl(asset.storage_path, 300);
if (error) throw error;

const ok = await fetch(signed.signedUrl);
const buf = Buffer.from(await ok.arrayBuffer());
console.log(`  signed URL      -> ${ok.status} ${ok.headers.get('content-type')} ${(buf.length / 1024).toFixed(0)} KB`);
// An mp4 carries "ftyp" at byte 4. Proves it is a video, not an error page.
console.log(`  is real mp4     -> ${buf.subarray(4, 8).toString() === 'ftyp'}`);

// 2. the unsigned public path must NOT work
const publicUrl = `${URL_}/storage/v1/object/public/movement-demos/${encodeURI(asset.storage_path)}`;
const pub = await fetch(publicUrl);
console.log(`  unsigned URL    -> ${pub.status} ${pub.status === 400 || pub.status === 404 ? '(denied, correct)' : 'LEAK - INVESTIGATE'}`);

// 3. anon key must not be able to list or read the bucket
const anon = createClient(URL_, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: list, error: listErr } = await anon.storage.from('movement-demos').list('Abdominals');
console.log(`  anon list       -> ${listErr ? 'denied (' + listErr.message + ')' : (list?.length ? 'LEAK - returned ' + list.length + ' objects' : 'empty, denied')}`);

// 4. a signature that has already expired must be refused
const { data: shortLived } = await admin.storage
  .from('movement-demos')
  .createSignedUrl(asset.storage_path, 1);
await new Promise((r) => setTimeout(r, 2500));
const stale = await fetch(shortLived.signedUrl);
console.log(`  expired URL     -> ${stale.status} ${stale.status === 400 ? '(refused, correct)' : 'STILL SERVING - INVESTIGATE'}`);

// 5. IS THE ROUTE ACTUALLY DEPLOYED?
//
// This check exists because everything above passed on 2026-09-09 while the
// feature was completely dead on the phone. The bucket was right, the rows were
// right, the signing was right - and /api/movement-demo had never been pushed,
// so every call 404ed and the player, which correctly renders nothing when a
// movement has no clip, rendered nothing for every movement.
//
// Storage being correct says nothing about the app being able to reach it. This
// asks the question the four checks above cannot.
//
// Unauthenticated on purpose: a 401 is the CORRECT answer here and proves the
// route is live and guarding itself. A 404 means it is not deployed.
const base = process.env.API_BASE_URL || 'https://selodia.app';
const probe = await fetch(`${base}/api/movement-demo?exercise=probe`);
const verdict =
  probe.status === 401
    ? 'deployed and requires auth, correct'
    : probe.status === 404
      ? 'NOT DEPLOYED - the feature is dead on the phone, push and redeploy'
      : `unexpected - expected 401, investigate`;
console.log(`  route (${base}) -> ${probe.status} (${verdict})`);
