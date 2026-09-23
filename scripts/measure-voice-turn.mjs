// HOW LONG A SPOKEN TURN TAKES, AND WHERE THE TIME GOES.
//
// For the ElevenLabs meeting on 24 September 2026. The notes said the slowest
// turns run to about five seconds and could not say where the five seconds
// went, which is a weak thing to take into a room with the people who built
// the other half of the pipeline.
//
// WHAT THIS CAN AND CANNOT SEE. A spoken turn is three parts:
//
//   1. ASR finalising          ElevenLabs. Not visible from here.
//   2. the custom-LLM round trip   OURS. This measures it.
//   3. TTS first byte          ElevenLabs. Not visible from here.
//
// Part 2 is the part Selodia owns and the only part worth arriving with a
// number for. It posts the OpenAI-shaped request their agent posts, to the
// same production URL, and times the stream the way the agent experiences it.
//
// THREE MOMENTS MATTER, not one:
//
//   open    the response starts. Deliberately immediate since 2026-09-09, so
//           this is near zero and is NOT the useful number.
//   words   the first real content token. This is when TTS can begin speaking
//           something true, and it is the number that matters.
//   done    the turn is complete.
//
// If `words` lands after 8s the person hears "Bear with me a moment" first,
// which is the holding line, and the run says so.
//
// IT WRITES TO THE DEMO ACCOUNT. Each run is a genuine turn through the whole
// pipeline, so chat rows land, exactly as they would from a real call. Never
// the other account.
//
//   node scripts/measure-voice-turn.mjs [runs]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RUNS = Number(process.argv[2] ?? 3);
const API = 'https://api.selodia.app';
const DEMO = 'unflumpapp@gmail.com';

const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL || E.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const ANON = E.EXPO_PUBLIC_SUPABASE_ANON_KEY || E.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (DEMO.includes('+test')) {
  console.error('Refusing: that is the account that is not hers.');
  process.exit(1);
}

async function demoToken() {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
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

// What the agent actually sends: OpenAI shape, identity in extra_body because
// their platform authenticates per agent and offers no per-conversation header.
function body(token, utterance) {
  return {
    model: 'selodia',
    stream: true,
    messages: [{ role: 'user', content: utterance }],
    elevenlabs_extra_body: { selodia_access_token: token },
  };
}

/** One turn, timed the way the agent experiences it. */
async function turn(token, utterance) {
  const t0 = performance.now();
  const res = await fetch(`${API}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body(token, utterance)),
  });
  const open = performance.now() - t0;
  if (!res.ok || !res.body) {
    return { error: `${res.status} ${(await res.text()).slice(0, 160)}` };
  }

  let words = null;
  let holding = false;
  let text = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      const piece = chunk?.choices?.[0]?.delta?.content;
      if (typeof piece === 'string' && piece.trim()) {
        if (piece.includes('Bear with me')) holding = true;
        else if (words === null) words = performance.now() - t0;
        text += piece;
      }
    }
  }
  return { open, words, done: performance.now() - t0, holding, text: text.trim() };
}

const ms = (n) => (n == null ? '  -  ' : `${Math.round(n)}ms`.padStart(7));

const UTTERANCES = [
  'How has my week been so far?',
  'What should I be thinking about today?',
  'Remind me what I said about my knee.',
];

console.log('\n  A SPOKEN TURN, THE PART WE OWN\n');
console.log(`  POST ${API}/v1/chat/completions, as the agent sends it.`);
console.log('  ASR and TTS are ElevenLabs and are not visible from here.\n');

const token = await demoToken();
const rows = [];

for (let i = 0; i < RUNS; i += 1) {
  const utterance = UTTERANCES[i % UTTERANCES.length];
  const r = await turn(token, utterance);
  if (r.error) {
    console.log(`  ${String(i + 1).padStart(2)}  FAILED  ${r.error}`);
    continue;
  }
  rows.push(r);
  console.log(
    `  ${String(i + 1).padStart(2)}  open ${ms(r.open)}   first words ${ms(r.words)}   complete ${ms(r.done)}` +
      (r.holding ? '   [holding line was spoken]' : '')
  );
  console.log(`      "${utterance}"`);
  console.log(`      -> ${r.text.slice(0, 90)}${r.text.length > 90 ? '...' : ''}`);
}

if (rows.length > 0) {
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const withWords = rows.filter((r) => r.words != null);
  console.log('\n  MEDIAN OF ' + rows.length + '\n');
  console.log(`    response opens      ${ms(median(rows.map((r) => r.open)))}`);
  console.log(`    first real words    ${ms(withWords.length ? median(withWords.map((r) => r.words)) : null)}   <- when TTS can start`);
  console.log(`    turn complete       ${ms(median(rows.map((r) => r.done)))}`);
  console.log(`\n    holding line heard in ${rows.filter((r) => r.holding).length} of ${rows.length} turns (fires after 8s)`);
  console.log('\n  Everything above is OUR half. Whatever the whole turn measures');
  console.log('  on a real call, the difference is ASR plus TTS.\n');
}
