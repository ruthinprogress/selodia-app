// DID TODAY'S FOUR CHANGES ACTUALLY LAND, ON THE LIVE APP?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-todays-work.mjs --email <test account>
//
// Everything shipped on 15 October 2026 was proved by checks against the
// source and by probes against the API. None of that proves the deployed
// server does it. This sends ONE real turn to the live endpoint on a TEST
// account and looks for all four:
//
//   1. THE LAYOUT (0673d44). A reply that would have been one block comes back
//      broken into paragraphs and lines.
//   2. THE FOURTH CACHE BREAKPOINT (b25d545). The reply call should read its
//      prefix from cache instead of re-reading about 8,700 fresh tokens.
//   3. THE TWO-STAGE REPLY (680c806). A turn_stage row, written BEFORE the
//      reply was finished.
//   4. THE FIELD INSTRUMENTATION (69e09d1). A turn_diagnostics row of kind
//      'fields', carrying names and no values.
//
// A TEST ACCOUNT ONLY, and it refuses any address without "test" in it. The
// message is invented and logs a meal, which is the shape that exercises all
// four at once. A few pence.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const API = 'https://api.selodia.app/api/ask-selodia';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { longestBlock, looksLikeWall } = await import(root + '/app/lib/reply-shape.ts');

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

await admin.from('user_profile').update({ lead_chat: true }).eq('user_id', user.id);

// A CLEAN DAY, OR THE SECOND RUN PROVES NOTHING. Run twice without this and the
// porridge is already logged, so the model correctly sets logIntent 'none',
// nothing is written, no stage is published - and the probe reports the
// two-stage reply as broken when it is the test that is wrong. Exactly the
// mistake the comparison harness made on 14 October with three porridge
// lunches. Today's food only, on a test account.
const dayStarted = new Date();
dayStarted.setHours(0, 0, 0, 0);
await admin.from('food_logs').delete().eq('user_id', user.id).gte('happened_at', dayStarted.toISOString());

const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const { data: session, error: otpError } = await anon.auth.verifyOtp({
  type: 'magiclink',
  token_hash: link.properties.hashed_token,
});
if (otpError || !session.session) throw new Error(`could not sign in: ${otpError?.message ?? 'no session'}`);
const token = session.session.access_token;

const { data: live } = await fetch('https://selodia.app/api/version').then((r) => r.json()).then((d) => ({ data: d }));
console.log(`\n  live: ${live.short}   test account: ${user.id}`);

// The name the phone would have invented, in the phone's own format.
const clientTurnId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// A MEAL AND A QUESTION IN ONE. The log gives stage one something to say; the
// question gives the writer enough to say that it would once have run on.
const MESSAGE =
  'Porridge with blueberries and a flat white for breakfast. ' +
  'I have got a new set of dumbbells up to 20kg and I want to start using them for my legs. ' +
  'What should I actually be doing, and what do I need to be careful of?';

console.log('  sending one turn...\n');
const started = Date.now();
const res = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-selodia-timing': '1' },
  body: JSON.stringify({ message: MESSAGE, clientTurnId }),
});
const body = await res.json().catch(() => ({}));
const took = Date.now() - started;

if (res.status !== 200) {
  console.log(`  THE TURN FAILED (${res.status}): ${body.error ?? JSON.stringify(body).slice(0, 200)}`);
  process.exit(1);
}

const reply = body.reply ?? '';
const results = [];
const verdict = (ok, name, note) => {
  results.push(ok);
  console.log(`  ${ok ? 'YES ' : 'NO  '} ${name.padEnd(34)} ${note}`);
};

console.log(`  the turn took ${(took / 1000).toFixed(1)}s\n`);

// 1. THE LAYOUT.
verdict(
  !looksLikeWall(reply),
  'laid out, not a wall',
  `${reply.length} characters, longest block ${longestBlock(reply)}`
);

// 2. THE FOURTH BREAKPOINT. The reply call should be reading, not re-reading.
const { data: usage } = await admin
  .from('model_usage')
  .select('call, input_tokens, cache_read_tokens, cache_write_tokens')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(4);
// WHAT TO EXPECT HERE, CORRECTED BY THIS PROBE ON ITS FIRST RUN.
//
// scripts/probe-cache-reuse.mjs predicted the reply call would drop to a few
// hundred fresh tokens, and measured exactly that - with a tool_result one
// line long. Production's tool_result is leadOutcome(): what the app did, THE
// WHOLE RECORD again, the context blocks, the app guide and the 1,400-word
// reply instructions. About 7,400 tokens, appended AFTER the last breakpoint,
// so no cache can ever cover it. All four breakpoints are already spent.
//
// So the real effect is smaller than the harness said: fresh went from about
// 8,675 to about 7,400, and the cached read rose from about 36,500 to about
// 42,400. Real, and roughly a seventh of what was claimed.
//
// The test is therefore the cached read, which is what the breakpoint moved,
// and not the fresh count, which is dominated by something it cannot reach.
const replyCall = (usage ?? []).find((u) => u.call === 'reply');
verdict(
  Boolean(replyCall && replyCall.cache_read_tokens > 40000),
  'the reply call reads from cache',
  replyCall
    ? `${replyCall.input_tokens} fresh, ${replyCall.cache_read_tokens} cached (was ~8,675 and ~36,500)`
    : 'no reply row recorded'
);

// 3. THE TWO-STAGE REPLY.
const { data: stage } = await admin
  .from('turn_stage')
  .select('acted, created_at')
  .eq('user_id', user.id)
  .eq('client_turn_id', clientTurnId)
  .maybeSingle();
verdict(
  Boolean(stage),
  'the first half was published',
  stage ? JSON.stringify(stage.acted) : 'no turn_stage row for this turn'
);

// AND THAT IT WAS EARLY, which is the entire point of it. The assistant's own
// row is written at the very end of the turn, so the stage must predate it.
const { data: lastReply } = await admin
  .from('chat_messages')
  .select('created_at')
  .eq('user_id', user.id)
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
const early = stage && lastReply && new Date(stage.created_at) < new Date(lastReply.created_at);
verdict(
  Boolean(early),
  'and published BEFORE the reply',
  stage && lastReply
    ? `${((new Date(lastReply.created_at) - new Date(stage.created_at)) / 1000).toFixed(1)}s earlier`
    : 'could not compare'
);

// 4. THE FIELD INSTRUMENTATION.
const { data: fields } = await admin
  .from('turn_diagnostics')
  .select('label, detail, created_at')
  .eq('user_id', user.id)
  .eq('kind', 'fields')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
verdict(
  Boolean(fields?.detail?.set?.length),
  'the fields it used were recorded',
  fields ? `${fields.label}: ${(fields.detail.set ?? []).join(', ')}` : 'no fields row'
);

// AND THAT IT CARRIES NO VALUES, checked against the message that was sent
// rather than against the shape of the code.
const asText = JSON.stringify(fields?.detail ?? {});
const leaked = ['porridge', 'blueberries', '20kg', 'dumbbells'].filter((w) =>
  asText.toLowerCase().includes(w.toLowerCase())
);
verdict(leaked.length === 0, 'and recorded no values', leaked.length === 0 ? 'names only' : `LEAKED: ${leaked.join(', ')}`);

if (body.timings) {
  console.log(`\n  timings: ${JSON.stringify(body.timings)}`);
}
console.log(`\n  ---- the reply ----\n${reply.replace(/^/gm, '  ')}\n`);

const failed = results.filter((r) => !r).length;
console.log(failed === 0 ? '  All four changes are live and working.\n' : `  ${failed} of ${results.length} did NOT hold.\n`);
