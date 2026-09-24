// Does the one round trip return the same thing as the twenty?
//
// turn_context() exists to replace twenty separate reads. If it returns even
// slightly different rows, the model quietly loses context and nothing fails -
// which is the exact shape of fault this project keeps finding. So the RPC is
// not wired into the route until this says the two agree, field for field, on
// real data.
//
//   node scripts/probe-turn-context-rpc.mjs

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
const dayStart = new Date();
dayStart.setHours(0, 0, 0, 0);

// ---- the old way: twenty reads ----------------------------------------
const t0 = performance.now();
const old = await Promise.all([
  db.from('chat_messages').select('classification, escalation_step, distress_revisit_count')
    .eq('user_id', userId).eq('source', 'chat').eq('role', 'assistant')
    .not('classification', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  db.from('chat_messages').select('role, content').eq('user_id', userId).eq('source', 'chat')
    .order('created_at', { ascending: false }).limit(40),
  db.from('user_context').select('*').order('category', { ascending: true }),
  db.from('food_logs').select('happened_at, raw_text, kcal, protein_g')
    .gte('happened_at', since.toISOString()).order('happened_at', { ascending: false }),
  db.from('activity_logs').select('happened_at, activity_type, duration_min, kcal_burned, eccentric_load, intensity')
    .gte('happened_at', since.toISOString()).order('happened_at', { ascending: false }),
  db.from('daily_activity_summaries').select('date, steps, kcal_burned, active_kcal, active_minutes, distance_km')
    .gte('date', since.toISOString().slice(0, 10)).order('date', { ascending: false }),
  db.from('hydration_logs').select('ml, happened_at')
    .gte('happened_at', since.toISOString()).order('happened_at', { ascending: false }),
  db.from('sleep_logs').select('night_of, duration_min, quality, awakenings')
    .gte('night_of', since.toISOString().slice(0, 10)).order('night_of', { ascending: false }),
  db.from('body_measurements').select('measured_at, weight_kg, body_fat_pct')
    .gte('measured_at', since.toISOString()).order('measured_at', { ascending: false }),
  db.from('health_context').select('*').maybeSingle(),
  db.from('cycle_events').select('event_date').eq('event_type', 'period_start')
    .order('event_date', { ascending: false }).limit(1).maybeSingle(),
  db.from('daily_summaries').select('summary_date, mediating_factor')
    .not('mediating_factor', 'is', null).order('summary_date', { ascending: false }).limit(1).maybeSingle(),
  db.from('user_profile').select(
    'height_cm, unsafe_goal_flagged_at, date_of_birth, biological_sex, activity_level, ' +
    'fat_focus_state, muscle_focus_state, protein_target_g, pending_fat_focus, pending_muscle_focus, ' +
    'pending_focus_asked_at, fat_focus_since, muscle_focus_since, consolidation_offered_at, ' +
    'lite_mode_since, pending_save, pending_save_asked_at').maybeSingle(),
  db.from('allergies').select('name, disclosed_at').order('disclosed_at', { ascending: true }),
  db.from('almanac_entries').select('id, title, content').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(50),
  db.from('almanac_entries').select('kind, title, created_at').eq('user_id', userId)
    .in('kind', ['symptom', 'insight']).order('created_at', { ascending: false }).limit(15),
  db.from('almanac_entries').select('title, category, content').eq('user_id', userId).eq('kind', 'me'),
  db.from('chat_messages').select('id, image_path').eq('user_id', userId).eq('source', 'chat')
    .not('image_path', 'is', null).eq('image_sent_to_model', false)
    .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  db.from('food_logs').select('kcal, protein_g').gte('happened_at', dayStart.toISOString()),
  db.from('body_measurements').select('weight_kg, body_fat_pct, bmr')
    .order('measured_at', { ascending: false }).limit(1).maybeSingle(),
]);
const oldMs = performance.now() - t0;

const KEYS = [
  'lastAssistantTurn', 'recentHistory', 'contextRows', 'recentFood', 'recentActivity',
  'recentDailyBurn', 'recentDrinks', 'recentSleep', 'recentMeasurements', 'healthContextRow',
  'lastPeriodRow', 'yesterdaySummary', 'profileRow', 'allergies', 'planRows',
  'insightRows', 'meRows', 'pendingCardRow', 'dayFood', 'latestMeasurement',
];
const oldByKey = Object.fromEntries(KEYS.map((k, i) => [k, old[i].data]));

// ---- the new way: one ---------------------------------------------------
const t1 = performance.now();
const { data: fresh, error } = await db.rpc('turn_context', {
  p_since: since.toISOString(),
  p_day_start: dayStart.toISOString(),
});
const newMs = performance.now() - t1;

if (error) {
  console.log('\n  RPC FAILED:', error.message, '\n');
  process.exit(1);
}

// Timestamps come back with different precision and zone spellings through the
// two paths, so both sides are normalised to an instant before comparing.
// Everything else must match exactly.
function normalise(value) {
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalise(value[k])]));
  }
  if (typeof value === 'string') {
    const d = Date.parse(value);
    if (!Number.isNaN(d) && /\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(d).toISOString();
  }
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === undefined) return null;
  return value;
}

console.log('\n  ONE ROUND TRIP AGAINST TWENTY\n');
let bad = 0;
for (const key of KEYS) {
  const a = normalise(oldByKey[key] ?? null);
  const b = normalise(fresh?.[key] ?? null);
  const same = JSON.stringify(a) === JSON.stringify(b);
  const count = Array.isArray(a) ? `${a.length} rows` : a ? '1 row' : 'null';
  if (!same) bad++;
  console.log(`  ${same ? 'same' : 'DIFF'}  ${key.padEnd(20)} ${count}`);
  if (!same) {
    console.log(`        twenty: ${JSON.stringify(a).slice(0, 220)}`);
    console.log(`        one   : ${JSON.stringify(b).slice(0, 220)}`);
  }
}

console.log(`\n  twenty reads: ${Math.round(oldMs)}ms`);
console.log(`  one read    : ${Math.round(newMs)}ms`);
console.log(bad === 0 ? '\n  identical on every field\n' : `\n  ${bad} FIELDS DIFFER - do not wire this in\n`);
process.exit(bad === 0 ? 0 : 1);
