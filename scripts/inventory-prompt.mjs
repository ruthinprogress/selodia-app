// WHAT THE PROMPT IS MADE OF, AND WHO READS EACH PART.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/inventory-prompt.mjs --email <test account>
//
// Ruth, 15 October 2026, after a weigh-in that 45,000 tokens of instruction
// got wrong and 792 tokens got right: "maybe there's too much architechture
// around it, limiting it's thinking." And then, the method: "Inventory the
// prompt - every block, its size, and which path actually reads it. I suspect
// several exist only for the old pre-led path and are dead weight on every
// turn."
//
// MEASURED ON A REAL TURN, not read off the source. Most of these blocks are
// built per turn out of somebody's own record, so a static count would be a
// guess about exactly the thing the guessing is meant to end. This sends one
// turn with the x-selodia-prompt header and prints what came back.
//
// WHY CHARACTERS AND NOT TOKENS. The ratio is near enough constant across
// prose, the question is which blocks are big rather than what any one costs
// to the token, and a tokeniser call per block would cost more than the
// answer is worth. The totals line converts once, at the end.
//
// RUN IT AGAIN AFTER EVERY CUT. That is the whole point of it: step three of
// her plan is to cut in passes and re-measure, and this is the measure.
//
// A TEST ACCOUNT ONLY. It sends a real turn and refuses any address without
// "test" in it.

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
await admin.from('user_profile').update({ lead_chat: true }).eq('user_id', user.id);

const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const { data: session } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });

// A QUESTION, NOT A LOG. A logging turn would write rows on the test account
// every time this is run, and the prompt is the same size either way.
const res = await fetch(API, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.session.access_token}`,
    'x-selodia-prompt': '1',
  },
  body: JSON.stringify({ message: 'What is my week looking like so far?' }),
});
const body = await res.json().catch(() => ({}));
if (res.status !== 200 || !body.prompt) {
  console.log(`  No inventory came back (${res.status}). ${body.error ?? ''}`);
  console.log('  If the status is 200, the deployed server predates this header.');
  process.exit(1);
}

const { total, cached, parts } = body.prompt;
const sorted = [...parts].sort((a, b) => b.chars - a.chars);
const widest = Math.max(...sorted.map((p) => p.name.length));

console.log(`\n  ONE TYPED TURN, LED. ${total.toLocaleString('en-GB')} characters of system prompt.\n`);
console.log(`  ${'block'.padEnd(widest)}  ${'chars'.padStart(7)}   ${'share'.padStart(5)}  read by`);
console.log(`  ${'-'.repeat(widest)}  ${'-'.repeat(7)}   ${'-'.repeat(5)}  ${'-'.repeat(26)}`);
for (const p of sorted) {
  const share = ((100 * p.chars) / total).toFixed(1);
  console.log(
    `  ${p.name.padEnd(widest)}  ${p.chars.toLocaleString('en-GB').padStart(7)}   ${share.padStart(4)}%  ${p.who}`
  );
}

// ROUGHLY FOUR CHARACTERS A TOKEN for English prose. Stated as an estimate
// because it is one, and because the decisions this informs are about which
// blocks are worth opening, not about a token budget.
const asTokens = (n) => `~${Math.round(n / 4).toLocaleString('en-GB')}`;
console.log(
  `\n  ${total.toLocaleString('en-GB')} characters, ${asTokens(total)} tokens.` +
    `\n  ${cached.toLocaleString('en-GB')} of it sits behind a cache breakpoint (${((100 * cached) / total).toFixed(0)}%),` +
    ` which makes it cheap to send and does NOT make it cheap to read.\n`
);

const biggest = sorted[0];
console.log(
  `  The largest single block is ${biggest.name} at ${((100 * biggest.chars) / total).toFixed(0)}% of the prompt.\n` +
    '  Open that one first, and read it against what the lean arm got right with\n' +
    '  792 tokens (scripts/probe-less-architecture.mjs) before cutting anything.\n'
);
