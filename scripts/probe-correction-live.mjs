// WHY A CORRECTION DID NOT LAND, ASKED OF THE LIVE APP.
//
//   node scripts/probe-correction-live.mjs --email <test account>
//
// The comparison run on 14 October lost two corrections in a row: the crust
// stayed at 241 kcal and the porridge stayed dry, and both replies said so
// honestly. The rows prove the update never happened; this says which half.
//
// It sends the two turns the run sent, on the test account, and prints what the
// route hands back for each - `saved` says whether anything was written - then
// reads the row to see whether it changed. Nothing is guessed from the reply.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const email = args[args.indexOf('--email') + 1];
if (!email || !/test/i.test(email)) {
  console.log('Give a test account: --email <address with "test" in it>');
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = list.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`No account uses ${email}.`);
  process.exit(1);
}

const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const { data: session } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
const token = session.session.access_token;

async function say(message) {
  const res = await fetch('https://api.selodia.app/api/ask-selodia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

await admin.from('chat_messages').delete().eq('user_id', user.id);
await admin.from('food_logs').delete().eq('user_id', user.id);

console.log('\n  1. logging the meal');
const first = await say('Sourdough crust with peanut butter, 10g more chicken breast, herbal tea with slice lime');
console.log(`     saved: ${JSON.stringify(first.saved ?? null)}`);

const { data: before } = await admin
  .from('food_logs')
  .select('id, raw_text, kcal')
  .eq('user_id', user.id);
console.log(`     rows: ${before.map((r) => `${r.kcal} kcal "${r.raw_text.slice(0, 40)}"`).join(' | ')}`);

console.log('\n  2. correcting it');
const second = await say('No, literally a crust, like 10g bread, 5g peanut butter');
console.log(`     saved: ${JSON.stringify(second.saved ?? null)}`);
console.log(`     reply: ${(second.reply ?? '').split('\n')[0].slice(0, 110)}`);

const { data: after } = await admin
  .from('food_logs')
  .select('id, raw_text, kcal')
  .eq('user_id', user.id);
console.log(`     rows: ${after.map((r) => `${r.kcal} kcal "${r.raw_text.slice(0, 40)}"`).join(' | ')}`);

const changed = before.length === after.length && before[0] && after[0] && before[0].kcal !== after[0].kcal;
console.log(
  `\n  ${changed ? 'THE CORRECTION LANDED' : 'THE CORRECTION DID NOT LAND'}: ` +
    `${before[0]?.kcal ?? '-'} kcal before, ${after[0]?.kcal ?? '-'} after, ` +
    `${after.length} row(s) where there was ${before.length}\n`
);
