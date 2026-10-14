// DOES A NUMBER SHE SAYS ONCE COME BACK WHEN SHE ASKS FOR IT LATER?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-standing-details.mjs --email <test account>
//
// Ruth, 14 October 2026, naming what the product is: "this is what replaces
// Claude, actually being able to pick up anywhere in chat and it knows what
// you're talking about and gives you exactly what you need, instead of a
// project in Claude."
//
// This is that test, reduced to its smallest honest form. Three turns against
// the LIVE chat on a test account:
//
//   1. a number given in passing, in the middle of something else
//   2. a turn about something entirely unrelated, so nothing is answered out
//      of the last message's own text
//   3. the number asked for
//
// IT PASSES ONLY IF TURN 3 CONTAINS THE DIGITS, with the spacing they arrived
// in. A reply that says where to look, or asks her to check a letter, is the
// failure this was built to catch - that is what the app did before today, and
// it is what she has her Claude project open for.
//
// EVERY NUMBER BELOW IS INVENTED and goes to a test account. A few pence.

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

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw new Error(`could not list accounts: ${listError.message}`);
const user = list.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`  No account uses ${email}.`);
  process.exit(1);
}
console.log(`\n  test account: ${user.id}`);

// THE NUMBERS. Invented, and deliberately shaped like the real things: an NHS
// number is ten digits in three groups, and a membership number is not.
const NHS = '417 902 6631';
const MEMBER = 'EX-4471902';

// A CLEAN START, so a pass cannot come from a row left by an earlier run.
await admin.from('care_constants').delete().eq('user_id', user.id);
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
  return { status: res.status, ms: Date.now() - started, reply: body.reply ?? body.error ?? '', body };
}

const turns = [
  // IN PASSING, not as the point of the message. If it only works when the
  // whole message is the number, it does not work.
  `Rang the surgery about my knee and they wanted my NHS number, it is ${NHS}. Anyway they said the physio referral has gone through so that is something. Also my AXA membership is ${MEMBER} if that is useful.`,
  // SOMETHING ELSE ENTIRELY, so turn 3 cannot be answered from the text above
  // it without actually holding the detail.
  'Had porridge with blueberries and a coffee with oat milk for breakfast.',
  // AND THE ASK.
  'what is my nhs number?',
];

const said = [];
for (const [i, message] of turns.entries()) {
  const out = await say(message);
  said.push(out);
  console.log(`\n  turn ${i + 1} (${out.status}, ${(out.ms / 1000).toFixed(1)}s)`);
  console.log(`  > ${message.slice(0, 90)}${message.length > 90 ? '…' : ''}`);
  console.log(out.reply ? out.reply.split('\n').map((l) => `    ${l}`).join('\n') : '    (no reply)');
}

const { data: stored } = await admin
  .from('care_constants')
  .select('label, value, note, source, confirmed')
  .eq('user_id', user.id);

console.log('\n  what is on file:');
for (const r of stored ?? []) {
  console.log(`    ${r.label}: ${r.value}   [${r.source}${r.confirmed ? '' : ', unchecked'}]`);
}
if ((stored ?? []).length === 0) console.log('    nothing');

const answer = said[2].reply ?? '';
const results = [
  ['the number was kept at all', (stored ?? []).some((r) => r.value === NHS)],
  ['the membership number was kept too', (stored ?? []).some((r) => r.value === MEMBER)],
  ['the spacing survived', (stored ?? []).some((r) => r.value === NHS)],
  ['the answer contains the digits', answer.includes(NHS)],
  // THE FAILURE THIS EXISTS FOR: an answer that points at the record instead of
  // being the record. Her words for what that is worth: "it offered no support
  // at all. I will co tinue to use Clause Health Project."
  [
    'the answer does not send her looking for it',
    !/check (the|your) letter|in your Me tab|How I Access Care|you can find it|have a look at/i.test(answer),
  ],
];

console.log('');
let failed = 0;
for (const [what, ok] of results) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed += 1;
}
console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
