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
// AND A CLEAN THREAD. The first run of this left the previous run's messages
// in place, so turn one was answered in the light of a correction that had not
// happened yet: "which is right: 200g, or the 100g of dry oats you told me
// afterwards?" The app was reading its context correctly; the probe had lied
// to it. run-comparison.mjs clears the thread for exactly this reason.
await admin.from('chat_messages').delete().eq('user_id', user.id);
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

const said = [];
for (const [i, message] of turns.entries()) {
  const out = await say(message);
  said.push(out.reply ?? '');
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
const lastReply = said[said.length - 1] ?? '';

const results = [
  ['the correction left one entry, not two', after.length === 1],
  ['it is still labelled lunch', after.length === 1 && /lunch/i.test(after[0].meal_label ?? '')],
  // THE THIRD TEST WAS WRONG ON ITS FIRST RUN and said so: it asserted the
  // calories came down, because a correction from 200g to 100g sounds smaller.
  // 200g of COOKED porridge is about 210 kcal and 100g of DRY oats is about
  // 380, so the honest answer goes up. A test that encodes my arithmetic rather
  // than the app's behaviour fails the app for being right.
  //
  // What matters is that the entry actually changed, and that the reply does
  // not send her to tidy up after the app. Those are the two faults.
  ['the entry actually changed', after.length === 1 && Number(after[0].kcal) !== 210],
  [
    'the reply does not send her to the Log to check or delete',
    !/still (reads|shows|in your record)|may still be there|is still in your record|delete the|two porridge/i.test(lastReply),
  ],
  // IF IT NAMES A FIGURE AT ALL, it must be the stored one. It is not required
  // to name one: the app prints its own itemised table under the reply, and the
  // reply is told in so many words never to write a receipt. The first version
  // of this demanded a number and failed a reply that correctly gave none.
  [
    "any figure in the reply is the one that is stored",
    after.length !== 1 ||
      !/[0-9]{2,5}[ ]*(kcal|calories)/i.test(lastReply) ||
      lastReply.includes(String(Math.round(Number(after[0].kcal)))),
  ],
];

console.log(`\n  day total now: ${total} kcal\n`);
let failed = 0;
for (const [what, ok] of results) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed += 1;
}
console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
