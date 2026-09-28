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

// A VARIED THREAD, and the reason is a lesson rather than a detail.
//
// This was twenty copies of one exchange, and a model handed twenty identical
// short turns writes something unlike anything it writes in a real conversation.
// That fixture produced 39 output tokens in one run and 400 in another the same
// afternoon, which is not a measurement, it is a coin. A probe whose numbers
// cannot be reproduced is worse than no probe: it produces confident conclusions
// about nothing.
const HISTORY = [
  { role: 'user', content: 'Had porridge with blueberries and a coffee with oat milk' },
  { role: 'assistant', content: 'Porridge and blueberries is a proper start to a cold morning.' },
  { role: 'user', content: 'Walked to the station rather than getting the bus' },
  { role: 'assistant', content: 'That will have added a fair few steps before nine.' },
  { role: 'user', content: 'Chicken salad and a flat white for lunch' },
  { role: 'assistant', content: 'A solid lunch. How is the afternoon looking?' },
  { role: 'user', content: 'Busy. I might not get out again today' },
  { role: 'assistant', content: 'Some days are like that. The morning walk still counted.' },
  { role: 'user', content: 'Did the barbell routine last night, skipped the deadlifts' },
  { role: 'assistant', content: 'Noted on the deadlifts. How did the rest of it feel?' },
  { role: 'user', content: 'Heavy, but fine. Shoulder held up' },
  { role: 'assistant', content: "Good to hear the shoulder held. That's the one that was bothering you." },
  { role: 'user', content: 'Slept badly though, woke about three' },
  { role: 'assistant', content: 'A three a.m. wake is its own kind of tired. Did you get back off?' },
  { role: 'user', content: 'Eventually. Two black coffees this morning to make up for it' },
  { role: 'assistant', content: 'That tracks. Anything else worth putting down?' },
  { role: 'user', content: 'Not really. Quiet day otherwise' },
  { role: 'assistant', content: 'Quiet days are worth logging too.' },
  { role: 'user', content: 'Waist 78cm this morning' },
  { role: 'assistant', content: "That's the first waist measurement in a while." },
];

// EACH CASE'S FACTS MATCH THE MESSAGE IT IS ANSWERING, which the second one did
// not and which made this probe lie twice in one afternoon. Her message was
// "56.9 this morning" and the app was supposedly reporting a saved porridge and a
// failed waist - a turn that cannot happen. Asked to reconcile a weigh-in with
// facts about breakfast, the model wrote several hundred words trying, hit the
// ceiling and fell back, and I twice read that as a fault in the code.
//
// A fixture that describes an impossible turn measures how a model copes with
// nonsense, which is not a number anybody needs.
const CASES = [
  { what: 'typed, nothing for the app to report', said: '56.9 this morning', voice: false, didLines: [] },
  {
    what: 'typed, a save and a failure to report',
    said: 'Two black coffees, and waist 78cm',
    voice: false,
    didLines: [
      'Two black coffees saved to her food log.',
      'The waist measurement did NOT save, after two attempts. Nothing of it is in her log.',
    ],
  },
  { what: 'spoken, nothing to report', said: '56.9 this morning', voice: true, didLines: [] },
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
      messages: [...HISTORY, { role: 'user', content: c.said }],
      data: DATA,
      voice: c.voice,
      didLines: c.didLines,
      safetyBlock: SAFETY_PROMPT_BLOCK,
    });
    times.push(Date.now() - t0);
    // THE REASON, NOT JUST THE TEXT. A run that falls back is the most
    // interesting result this probe can produce and the first version threw it
    // away, printing an empty sample that looked like a formatting bug.
    sample = reply.fellBack === null ? reply.text : `FELL BACK: ${reply.fellBack} (${reply.detail})`;
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
