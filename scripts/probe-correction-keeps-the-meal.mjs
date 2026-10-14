// DOES A CORRECTED LUNCH STAY LUNCH, ON THE LIVE APP?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-correction-keeps-the-meal.mjs --email <test account>
//
// Ruth, 14 October 2026: "fix corrections properly, find why T4 set it to
// breakfast."
//
// The unit check proves the helper. This proves the APP: it logs a lunch
// through the live chat, corrects the quantity and nothing else, and then reads
// the row back out of the database rather than believing the reply.
//
// IT CHECKS THE ROW, NOT THE WORDS. The reply saying "I have updated your
// lunch" is exactly what it said on the day it moved the meal to breakfast.
//
// Every detail is invented and it runs on a test account. A few pence.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const API = 'https://api.selodia.app/api/ask-selodia';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const args = process.argv.slice(2);
const email = args[args.indexOf('--email') + 1];
if (!args.includes('--email') || !email) {
  console.log('Give the test account: --email <address>');
  process.exit(1);
}
if (!/test/i.test(email)) {
  console.log('  Refusing: the address has no "test" in it, and this must never run on her own account.');
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = list.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`  No account uses ${email}.`);
  process.exit(1);
}
console.log(`\n  test account: ${user.id}`);

const dayStart = new Date();
dayStart.setHours(0, 0, 0, 0);

// A CLEAN DAY, so a pass cannot come from a row an earlier run left behind.
const { data: old } = await admin
  .from('food_logs')
  .select('id')
  .eq('user_id', user.id)
  .gte('happened_at', dayStart.toISOString());
for (const r of old ?? []) {
  await admin.from('food_items').delete().eq('food_log_id', r.id);
  await admin.from('food_logs').delete().eq('id', r.id);
}
await admin.from('user_profile').update({ lead_chat: true }).eq('user_id', user.id);

const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const { data: session, error: otpError } = await anon.auth.verifyOtp({
  type: 'magiclink',
  token_hash: link.properties.hashed_token,
});
if (otpError || !session.session) throw new Error(`could not sign in: ${otpError?.message ?? 'no session'}`);
const token = session.session.access_token;

async function say(message) {
  const started = Date.now();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - started, reply: body.reply ?? body.error ?? '' };
}

async function rows() {
  const { data } = await admin
    .from('food_logs')
    .select('id, raw_text, meal_label, kcal')
    .eq('user_id', user.id)
    .gte('happened_at', dayStart.toISOString())
    .order('happened_at', { ascending: true });
  return data ?? [];
}

const turns = [
  'For lunch today I had 200g of porridge with blueberries.',
  'That porridge was 100g of dry oats, not 200g.',
];

for (const [i, message] of turns.entries()) {
  const out = await say(message);
  console.log(`\n  turn ${i + 1} (${out.status}, ${(out.ms / 1000).toFixed(1)}s)`);
  console.log(`  > ${message}`);
  console.log(out.reply ? out.reply.split('\n').map((l) => `    ${l}`).join('\n') : '    (no reply)');
  if (i === 0) {
    const before = await rows();
    console.log(`\n  after logging: ${before.map((r) => `${r.meal_label} / ${r.kcal} kcal`).join(' | ') || 'nothing'}`);
  }
}

const after = await rows();
console.log('\n  what is on the day now:');
for (const r of after) console.log(`    ${r.meal_label} · ${r.kcal} kcal · ${r.raw_text}`);
if (after.length === 0) console.log('    nothing');

const total = after.reduce((n, r) => n + Number(r.kcal ?? 0), 0);
const reply = (await rows()) && '';

const results = [
  ['the correction left one entry, not two', after.length === 1],
  ['it is still labelled lunch', after.length === 1 && /lunch/i.test(after[0].meal_label ?? '')],
  ['the calories came down', after.length === 1 && Number(after[0].kcal) > 0 && Number(after[0].kcal) < 400],
];

console.log(`\n  day total now: ${total} kcal\n`);
let failed = 0;
for (const [what, ok] of results) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed += 1;
}
console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
void reply;
process.exit(failed > 0 ? 1 : 0);
