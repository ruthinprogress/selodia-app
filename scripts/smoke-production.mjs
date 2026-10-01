// IS THE THING THAT IS LIVE ACTUALLY WORKING?
//
//   node scripts/smoke-production.mjs
//
// check-live-deployment.mjs answers "is the right code live". This answers the
// next question, which is not the same one: does it RUN. A deployment can be the
// right sha, hold every domain, and still 500 on the first request because an
// environment variable is missing on this project or a key has expired - and
// neither of those shows up in a build log.
//
// WHAT IT TOUCHES, and why these:
//
//   /api/ask-selodia        chat, and the route everything else leans on
//   /api/voice/session      voice. It mints an ElevenLabs conversation token, so
//                           it is the one call that proves ELEVENLABS_API_KEY is
//                           present and valid on THIS project. Nothing else does.
//   /v1/chat/completions     the voice adapter - what ElevenLabs calls back into
//                           while she is speaking. Shares the pipeline with chat
//                           but not the entry point, and has had its own bugs.
//   /support                a static page, so a total build failure is obvious
//                           even if everything above is misreported
//
// IT RUNS ON THE DEMO ACCOUNT, unflumpapp@gmail.com, never hers. One trivial
// chat turn and one voice turn, so it costs a fraction of a penny in model
// tokens. It writes two chat messages to the demo account's history and nothing
// else; it does not log food, change a profile or touch her week.
//
// A TOKEN IS A CREDENTIAL. The voice token this mints is short-lived and grants a
// conversation on the account, so it is checked for shape and never printed.

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.selodia.app';
const SITE = 'https://selodia.app';
const DEMO = 'unflumpapp@gmail.com';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;

if (DEMO.includes('ruth')) {
  console.error('Refusing: that is her account, not the demo one.');
  process.exit(1);
}

async function demoToken() {
  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ type: 'magiclink', email: DEMO }),
  }).then((r) => r.json());
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  const session = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  }).then((r) => r.json());
  if (!session.access_token) throw new Error('no access token for the demo account');
  return session.access_token;
}

let pass = 0;
const failures = [];
// ONE READ PER RESPONSE. The first version built its failure message with
// `${await res.text()}` inside an ok() call, and a template literal is evaluated
// whether the assertion needs it or not - so every SUCCESSFUL response had its
// body consumed before res.json() could read it, and three checks failed with
// "Body has already been read" against a production that was fine. A test that
// fails on working code is worse than no test.
async function read(res) {
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON, which is itself worth reporting rather than throwing over.
  }
  return { text, json };
}

// The words out of an SSE stream. Tolerant on purpose: a [DONE] sentinel, a
// keep-alive comment or a chunk with no content in it are all normal and none of
// them mean the adapter said nothing.
function sseText(body) {
  let out = '';
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload);
      const piece = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
      if (typeof piece === 'string') out += piece;
    } catch {
      // A partial line at the end of a stream is not a failure.
    }
  }
  return out;
}

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  PASS  ${name}${detail ? `   ${detail}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const token = await demoToken();
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

console.log('\n  PRODUCTION SMOKE\n');

// A page, so a wholesale build failure cannot hide behind a nicer error.
await check('the site serves a page', async () => {
  const res = await fetch(`${SITE}/support`);
  ok(res.ok, `GET /support -> ${res.status}`);
  void (await res.text());
  const region = res.headers.get('x-vercel-id') ?? '';
  // lhr1 is the point of vercel.json. Reported rather than asserted: a region
  // miss is worth seeing and is not a reason to call production broken.
  return region.includes('lhr1') ? 'lhr1' : `region ${region.split('::')[0] || '?'}`;
});

await check('chat answers', async () => {
  const res = await fetch(`${API}/api/ask-selodia`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ message: 'Just checking you are there.' }),
  });
  const { text, json } = await read(res);
  ok(res.ok, `-> ${res.status} ${text.slice(0, 200)}`);
  const reply = json?.reply;
  ok(typeof reply === 'string' && reply.trim(), `a 200 with no reply in it: ${text.slice(0, 200)}`);
  return `"${reply.slice(0, 44)}${reply.length > 44 ? '…' : ''}"`;
});

await check('voice can open a session', async () => {
  const res = await fetch(`${API}/api/voice/session`, { method: 'POST', headers: auth, body: '{}' });
  const { text, json } = await read(res);
  ok(res.ok, `-> ${res.status} ${text.slice(0, 200)}`);
  // The field the phone's SDK needs. A 200 carrying nothing usable is the exact
  // shape of a missing ELEVENLABS_API_KEY handled too politely.
  const tok = json?.token ?? json?.conversationToken ?? json?.conversation_token;
  ok(
    typeof tok === 'string' && tok.length > 20,
    `no usable token; keys were: ${Object.keys(json ?? {}).join(', ') || '(not JSON)'}`
  );
  return 'token minted';
});

await check('the voice adapter answers', async () => {
  const res = await fetch(`${API}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'selodia',
      messages: [{ role: 'user', content: 'Just checking you are there.' }],
      // HOW THE REAL CALLER PROVES WHO IS SPEAKING, and the key name matters.
      // The envelope is `elevenlabs_extra_body` - I first wrote
      // `custom_llm_extra_body` from memory and got a correct 401, which is the
      // adapter working and the test being wrong. TOKEN_KEYS in the route is the
      // list it accepts.
      elevenlabs_extra_body: { supabase_access_token: token },
    }),
  });
  const { text } = await read(res);
  ok(res.ok, `-> ${res.status} ${text.slice(0, 200)}`);
  // IT STREAMS, like the OpenAI endpoint it imitates - Server-Sent Events, one
  // `data:` line per chunk, with the words in choices[0].delta.content. The first
  // version of this check read it as a single JSON object with a `message`, which
  // is the non-streaming shape, and reported a working adapter as broken.
  const said = sseText(text);
  ok(said.trim(), `no content in the stream: ${text.slice(0, 200)}`);
  return `"${said.slice(0, 44)}${said.length > 44 ? '…' : ''}"`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
