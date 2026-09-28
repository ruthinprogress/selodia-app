// WHAT THE SECOND CALL COSTS, BEFORE DECIDING ANYTHING ABOUT IT.
//
// Turning REPLY_WRITTEN_AFTER_THE_SAVES on adds a model call to every turn. It
// cannot run in parallel with the classification, because the whole point is that
// the reply is written AFTER the saving and knows what happened. So it is
// sequential by design, and it lands on the critical path of a spoken turn, which
// was measured at 3,239ms to the first spoken character on 24 September.
//
// This project has a decision pattern about exactly this - measure the fix before
// you build it - and the same rule applies to measuring a cost before worrying
// about it. So: how long does the reply writer actually take, typed and spoken?
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-reply-writer-latency.mjs
//
// It makes real calls and costs real money. Six of them.

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { writeReplyAfterSaves } from '../app/lib/chat-path.ts';
import { SAFETY_PROMPT_BLOCK } from '../app/lib/safety-classification.ts';

const ROOT = 'C:/Users/ruthi/unflump-app';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// A week with something in every block, so the facts are the size they really are
// rather than the size an empty fixture makes them.
const DATA = {
  days: 7,
  food: [
    { happened_at: '2026-09-22T12:00:00Z', raw_text: 'eggs, soup, curry', kcal: 1340, protein_g: 103 },
    { happened_at: '2026-09-23T12:00:00Z', raw_text: 'toast, sandwich, risotto', kcal: 1350, protein_g: 58 },
    { happened_at: '2026-09-24T12:00:00Z', raw_text: 'yoghurt, wrap, stir fry', kcal: 1340, protein_g: 80 },
    { happened_at: '2026-09-25T12:00:00Z', raw_text: 'toast, leftovers', kcal: 820, protein_g: 49 },
  ],
  activity: [
    { happened_at: '2026-09-25T09:00:00Z', activity_type: 'run', duration_min: 32, kcal_burned: 280, intensity: 'moderate' },
    { happened_at: '2026-09-23T18:00:00Z', activity_type: 'yoga', duration_min: 45, kcal_burned: 120, intensity: 'light' },
  ],
  dailyBurn: [
    { date: '2026-09-24', steps: 2262, kcal_burned: null, active_minutes: null },
    { date: '2026-09-25', steps: 8420, kcal_burned: null, active_minutes: null },
    { date: '2026-09-26', steps: 9820, kcal_burned: null, active_minutes: null },
  ],
  drinks: [
    { happened_at: '2026-09-25T10:00:00Z', ml: 1900 },
    { happened_at: '2026-09-26T10:00:00Z', ml: 1525 },
  ],
  sleep: [{ night_of: '2026-09-26', duration_min: 431, quality: 'ok', awakenings: 1 }],
  measurements: [
    { measured_at: '2026-09-24T08:16:00Z', weight_kg: 55.58, body_fat_pct: 27.9 },
    { measured_at: '2026-09-25T08:00:00Z', weight_kg: 55.9, body_fat_pct: 27.8 },
  ],
  lastPeriodStart: '2026-09-21',
};

// Forty turns of history, which is what a real thread carries into the call. An
// empty history would measure a call this route never makes.
const HISTORY = [];
for (let i = 0; i < 20; i += 1) {
  HISTORY.push({ role: 'user', content: 'Had porridge with blueberries and a coffee' });
  HISTORY.push({ role: 'assistant', content: 'Sounds like a warm start. How is the morning going?' });
}

const CASES = [
  { what: 'typed, nothing for the app to report', voice: false, didLines: [] },
  { what: 'typed, a save and a failure to report', voice: false, didLines: [
    'The porridge and coffee saved to her food log.',
    'A waist measurement in the same message did NOT save, after two attempts.',
  ] },
  { what: 'spoken, nothing to report', voice: true, didLines: [] },
];

const RUNS = 2;

console.log('\n  THE REPLY WRITER, TIMED\n');
console.log('  Real calls, real prompt, a 40-turn history. The classification call is');
console.log('  unchanged and is NOT measured here - this is only what was added.\n');

const all = [];

for (const c of CASES) {
  const times = [];
  let sample = '';
  for (let r = 0; r < RUNS; r += 1) {
    const t0 = Date.now();
    const reply = await writeReplyAfterSaves({
      anthropic,
      model: 'claude-sonnet-5',
      messages: [...HISTORY, { role: 'user', content: '56.9 this morning' }],
      data: DATA,
      voice: c.voice,
      didLines: c.didLines,
      safetyBlock: SAFETY_PROMPT_BLOCK,
    });
    times.push(Date.now() - t0);
    if (reply) sample = reply;
  }
  const best = Math.min(...times);
  const worst = Math.max(...times);
  all.push(...times);
  console.log(`  ${c.what}`);
  console.log(`    ${times.map((t) => `${t}ms`).join(', ')}   (best ${best}, worst ${worst})`);
  console.log(`    > ${sample.slice(0, 150)}${sample.length > 150 ? '…' : ''}\n`);
}

const median = [...all].sort((a, b) => a - b)[Math.floor(all.length / 2)];
console.log(`  MEDIAN ACROSS ALL ${all.length} CALLS: ${median}ms\n`);
console.log('  For scale: the whole spoken turn measured 3,239ms to the first');
console.log('  spoken character on 24 September, and the classification call inside');
console.log('  it measured about 2,900ms against the real prompt and the real tool.\n');
