// WHICH OF THE CONTEXT READS IS THE SLOW ONE?
//
// They all go out together in one Promise.all, so the phase costs whatever the
// SLOWEST of them costs - not the sum. A phase measured at 2 to 4 seconds
// therefore means at least one of these queries takes 2 to 4 seconds on its
// own, which is a long time for a handful of rows and usually means an index
// that is not there.
//
// Run with the real user's token so RLS is in the path exactly as it is in
// production. Timed one at a time, because timing them together only ever
// tells you the answer you already have.
//
//   node scripts/probe-context-queries.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const DEMO = 'unflumpapp@gmail.com';

if (DEMO.includes('+test')) {
  console.error('Refusing: that is the account that is not hers.');
  process.exit(1);
}

const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: DEMO }),
}).then((r) => r.json());
const session = await fetch(`${SUPA}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', token_hash: link?.properties?.hashed_token ?? link?.hashed_token }),
}).then((r) => r.json());

const token = session.access_token;
const userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
const db = createClient(SUPA, ANON, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});

const since = new Date();
since.setDate(since.getDate() - 3);
const sinceISO = since.toISOString();
const dayStart = new Date();
dayStart.setHours(0, 0, 0, 0);
const dayStartISO = dayStart.toISOString();

// Each one mirrors the route. Named for what it is FOR, so a slow line points
// at something in the prompt rather than at a table.
const QUERIES = {
  'escalation state': () =>
    db.from('chat_messages').select('classification, escalation_step, distress_revisit_count')
      .eq('user_id', userId).eq('source', 'chat').eq('role', 'assistant')
      .not('classification', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  'last 40 messages': () =>
    db.from('chat_messages').select('role, content')
      .eq('user_id', userId).eq('source', 'chat')
      .order('created_at', { ascending: false }).limit(40),
  'user_context (select *)': () => db.from('user_context').select('*').order('category', { ascending: true }),
  'food, 3 days': () =>
    db.from('food_logs').select('raw_text, kcal, protein_g, happened_at').gte('happened_at', sinceISO),
  'activity, 3 days': () => db.from('activity_logs').select('*').gte('happened_at', sinceISO),
  'daily burn': () => db.from('daily_burn').select('*').gte('day', sinceISO.slice(0, 10)),
  'drinks': () => db.from('drink_logs').select('*').gte('happened_at', sinceISO),
  'sleep': () => db.from('sleep_logs').select('*').gte('happened_at', sinceISO),
  'measurements': () => db.from('body_measurements').select('*').gte('measured_at', sinceISO),
  'health context': () => db.from('health_context').select('*').maybeSingle(),
  'last period': () => db.from('cycle_events').select('*').order('happened_at', { ascending: false }).limit(1).maybeSingle(),
  'user_profile': () => db.from('user_profile').select('*').maybeSingle(),
  'allergies': () => db.from('user_allergies').select('*'),
  'almanac insights': () =>
    db.from('almanac_entries').select('kind, title, created_at').eq('user_id', userId)
      .in('kind', ['symptom', 'insight']).order('created_at', { ascending: false }).limit(15),
  'almanac me cards': () =>
    db.from('almanac_entries').select('title, category, content').eq('user_id', userId).eq('kind', 'me'),
  "day's food": () => db.from('food_logs').select('kcal, protein_g').gte('happened_at', dayStartISO),
  'latest measurement': () =>
    db.from('body_measurements').select('weight_kg, body_fat_pct, bmr')
      .order('measured_at', { ascending: false }).limit(1).maybeSingle(),
};

console.log('\n  EACH CONTEXT READ, ON ITS OWN, WITH RLS IN THE PATH\n');

const results = [];
for (const [name, run] of Object.entries(QUERIES)) {
  // A PostgREST builder is thenable but not a Promise, so it has no .catch
  // until it has been awaited. Wrapped rather than chained.
  const attempt = async () => {
    try {
      return await run();
    } catch (e) {
      return { error: e };
    }
  };

  // Twice: the first can pay for a cold connection and tells you nothing.
  await attempt();
  const t0 = performance.now();
  const res = await attempt();
  const took = performance.now() - t0;
  const rows = Array.isArray(res?.data) ? res.data.length : res?.data ? 1 : 0;
  const bytes = res?.data ? JSON.stringify(res.data).length : 0;
  results.push({ name, took, rows, bytes, error: res?.error?.message ?? null });
}

results.sort((a, b) => b.took - a.took);
for (const r of results) {
  console.log(
    `  ${String(Math.round(r.took)).padStart(6)}ms  ${String(r.rows).padStart(4)} rows  ` +
      `${String(Math.round(r.bytes / 1024)).padStart(4)} KB  ${r.name}${r.error ? `  [${r.error}]` : ''}`
  );
}

const slowest = results[0];
console.log(`\n  The phase cannot be faster than its slowest read: ${Math.round(slowest.took)}ms (${slowest.name}).`);
console.log(`  Total if they ran one after another: ${Math.round(results.reduce((n, r) => n + r.took, 0))}ms\n`);
