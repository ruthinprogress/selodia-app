// RUN RUTH'S EXAMPLES THROUGH THE REAL CHAT, ON A TEST ACCOUNT, AND WRITE THEM
// UP BESIDE HER PROJECT'S ANSWERS.
//
//   node scripts/run-comparison.mjs --email <test account email> [--only H1,AXA] [--dry]
//
// The test she signed off on 13 October 2026: her examples, put to Selodía on a
// test account that has the relevant history, side by side with her Claude
// Project's answers, scored, and the call is hers.
//
// HER DETAILS NEVER ENTER THE REPOSITORY. The cases are read at run time from
// the comparison folder in her Drive (comparison-cases.json), and the write-up
// goes back there. This file holds only the machinery.
//
// THE TEST ACCOUNT IS HERS, MADE BY HER. Nothing here creates an account or
// knows a password. It finds the account by the email she gives, and signs in
// to that one account with the server key - a magic link generated and
// redeemed on the spot - so the real route runs exactly as it does for her
// phone, through the real guards, on the live server.
//
// THE NEW CHAT IS SWITCHED ON FOR THE TEST ACCOUNT before the run, because the
// point is to measure the chat that leads. Each case starts on a cleared thread
// (the test account's messages only) and is given the background she wrote down,
// said the way she would say it.
//
// A real run costs real money: roughly 5 to 10 US cents a turn on the lead
// model, so about a pound for all eight cases with their background turns.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DRIVE = "H:/My Drive/Selodia App Project Master Folder/Build Specs/Ruth's Claude Project comparison notes";
const CASES = path.join(DRIVE, 'comparison-cases.json');
const API = 'https://api.selodia.app/api/ask-selodia';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const email = arg('email');
const only = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const dry = args.includes('--dry');

if (!email) {
  console.log('Give the test account: --email <address>');
  process.exit(1);
}

const { cases } = JSON.parse(fs.readFileSync(CASES, 'utf8'));
const chosen = cases.filter((c) => only.length === 0 || only.includes(c.id));
console.log(`\n  ${chosen.length} case(s): ${chosen.map((c) => c.id).join(', ')}`);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// FIND THE ACCOUNT, and refuse anything that is not plainly a test account, so
// a typo can never run this against her real one.
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw new Error(`could not list accounts: ${listError.message}`);
const user = list.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`  No account uses ${email}. Make it on the phone first.`);
  process.exit(1);
}
if (!/test/i.test(email)) {
  console.log('  Refusing: the address has no "test" in it, and this must never run on her own account.');
  process.exit(1);
}
console.log(`  test account found: ${user.id}`);

if (dry) {
  console.log('  --dry: stopping before signing in or sending anything.');
  process.exit(0);
}

const { error: switchError } = await admin.from('user_profile').update({ lead_chat: true }).eq('user_id', user.id);
if (switchError) throw new Error(`could not switch the new chat on: ${switchError.message}`);

// SIGN IN WITHOUT A PASSWORD: a magic link, generated with the server key and
// redeemed here.
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (linkError) throw new Error(`could not make a sign-in link: ${linkError.message}`);
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-selodia-timing': '1' },
    body: JSON.stringify({ message }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - started, ...body };
}

const results = [];
for (const c of chosen) {
  console.log(`\n  ${c.id}: ${c.title}`);
  // A CLEAN THREAD FOR EACH CASE. The chat is one continuous conversation, so
  // without this the knee case would be answered with the porridge in view.
  // Only the TEST account's messages, and only its chat, never anything else:
  // what earlier cases saved stays, the way a real record accumulates.
  const { error: clearError } = await admin.from('chat_messages').delete().eq('user_id', user.id);
  if (clearError) console.log(`    could not clear the thread: ${clearError.message}`);
  for (const s of c.seed) {
    const r = await say(s);
    console.log(`    background turn: ${r.status}, ${Math.round(r.ms / 1000)}s`);
  }
  const r = await say(c.message);
  // A WAITING OFFER IS ANSWERED, so the run shows whether a yes actually saves.
  let yes = null;
  if (/Want me to keep|keep that in/i.test(r.reply ?? '')) yes = await say('Yes');
  console.log(`    the example: ${r.status}, ${Math.round(r.ms / 1000)}s${yes ? `; yes: ${yes.status}` : ''}`);
  results.push({ c, r, yes });
}

// THE COST, from the rows the route itself wrote.
const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const { data: usage } = await admin
  .from('model_usage')
  .select('model, call, cost_micro_cents')
  .eq('user_id', user.id)
  .gte('created_at', since);

const lines = [
  '# Selodía and your Project, side by side',
  '',
  `**Run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, on the test account, with the chat that leads.** Each example was given its background first, in your words, then sent exactly as you wrote it.`,
  '',
];
for (const { c, r, yes } of results) {
  lines.push(`## ${c.id}: ${c.title}`, '');
  lines.push(`**You said:** ${c.message.split('\n').join(' ')}`, '');
  lines.push(`**Your Project:** ${c.project}`, '');
  lines.push(`**Selodía:**`, '', r.reply ? r.reply : `(no reply - status ${r.status}${r.error ? `, ${r.error}` : ''})`, '');
  if (r.draft) lines.push(`**Draft written:** ${r.draft.title}${r.draft.to ? `, to ${r.draft.to}` : ''}${r.draft.subject ? `, subject "${r.draft.subject}"` : ''}`, '');
  if (yes) lines.push(`**After "Yes":** ${yes.reply ?? `(status ${yes.status})`}`, '');
  lines.push(`**Passes if:** ${c.pass}`, '', `**Fails if:** ${c.fail}`, '', `**Score:** to be marked`, '', `_Took ${Math.round(r.ms / 1000)} seconds._`, '');
}
const total = (usage ?? []).reduce((s, u) => s + (u.cost_micro_cents ?? 0), 0);
lines.push('## Cost', '', `${(usage ?? []).length} model calls, ${(total / 1e6).toFixed(2)} US cents in all, across ${results.reduce((n, x) => n + x.c.seed.length + 1 + (x.yes ? 1 : 0), 0)} turns.`);

const stamp = new Date().toISOString().slice(0, 10);
const md = path.join(DRIVE, `${stamp} Comparison run.md`);
fs.writeFileSync(md, lines.join('\n'));
console.log(`\n  written: ${md}`);
console.log('  render it for her with scripts/md2docx.py, mark the scores, then delete the .md.\n');
