// The pipeline on its own, with the voice adapter taken out of the picture.
//
// WHY THIS EXISTS. measure-voice-turn.mjs posts through /v1/chat/completions,
// which is correct for "what does the agent experience" and misleading for
// "how fast is the turn". Back-to-back turns make the adapter's supersede
// guard treat each one as a continuation of the last and WAIT for the previous
// answer - so the measured time grows with the number of runs, and a six-run
// sample reads far worse than a three-run one for reasons that have nothing to
// do with the pipeline.
//
// This posts straight to /api/ask-selodia with a pause between turns, so each
// one is a fresh turn and the number means what it says.
//
//   node scripts/probe-pipeline-direct.mjs [runs] [gapSeconds]

import fs from 'node:fs';
import path from 'node:path';

const RUNS = Number(process.argv[2] ?? 4);
const GAP = Number(process.argv[3] ?? 35) * 1000;
const API = 'https://api.selodia.app';
const DEMO = 'unflumpapp@gmail.com';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;

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

const UTTERANCES = [
  'How has my week been so far?',
  'What should I be thinking about today?',
  'Remind me what I said about my knee.',
  'How am I doing on protein this week?',
];

const token = await demoToken();
const times = [];

console.log(`\n  THE PIPELINE ALONE, ${GAP / 1000}s between turns so nothing supersedes\n`);

for (let i = 0; i < RUNS; i++) {
  const utterance = UTTERANCES[i % UTTERANCES.length];
  const t0 = performance.now();
  const res = await fetch(`${API}/api/ask-selodia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: utterance, voice: true }),
  });
  const took = performance.now() - t0;
  const data = res.ok ? await res.json() : null;
  times.push(took);
  console.log(
    `  ${i + 1}  ${String(Math.round(took)).padStart(6)}ms  ${res.status}  "${utterance}"\n` +
      `        -> ${(data?.reply ?? '(no reply)').slice(0, 76)}...`
  );
  if (i < RUNS - 1) await new Promise((r) => setTimeout(r, GAP));
}

const sorted = [...times].sort((a, b) => a - b);
console.log(`\n  median ${Math.round(sorted[Math.floor(sorted.length / 2)])}ms`);
console.log(`  best   ${Math.round(sorted[0])}ms   worst ${Math.round(sorted[sorted.length - 1])}ms\n`);
