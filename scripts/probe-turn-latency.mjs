// WHERE THE SECONDS GO IN A TURN, NOW THAT THERE ARE TWO CALLS.
//
// Her real turns went from a 3.3s median to 7.0s the day the second call went
// live, so voice is back on the old path until this is fixed. Before changing
// anything else: measure the two calls separately, against realistic prompts,
// and find out which knob is worth turning.
//
// WHY EACH CONFIGURATION IS HERE. The first run of this kind was useless because
// the variance swamped the signal - a bare call carrying no system prompt at all
// measured 3.4s in the same run as a full one. So every configuration is run
// several times and the MINIMUM is reported alongside the median: the minimum is
// the closest thing to what the call costs when nothing else is going wrong, and
// the spread between them is the honest measure of how much of this is noise.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-turn-latency.mjs

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { replyPrompt } from '../app/lib/reply-prompt.ts';
import { turnFacts } from '../app/lib/turn-facts.ts';
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
const MODEL = 'claude-sonnet-5';
const RUNS = 4;

// Her week, so the facts block is the size it really is.
const DATA = {
  days: 7,
  food: [
    { happened_at: '2026-09-26T12:00:00Z', raw_text: 'Five Guys cheeseburger and fries', kcal: 1100, protein_g: 52 },
    { happened_at: '2026-09-27T20:04:00Z', raw_text: 'lamb pizza, half a lager', kcal: 2068, protein_g: 72.9 },
  ],
  activity: [{ happened_at: '2026-09-24T10:44:00Z', activity_type: 'pushups', duration_min: 2, kcal_burned: 7, intensity: 'moderate' }],
  dailyBurn: [{ date: '2026-09-27', steps: 8391, kcal_burned: null, active_minutes: null }],
  drinks: [{ happened_at: '2026-09-26T20:35:00Z', ml: 1568 }],
  sleep: [],
  measurements: [
    { measured_at: '2026-09-27T07:58:00Z', weight_kg: 56.85, body_fat_pct: 27.4 },
    { measured_at: '2026-09-28T07:41:00Z', weight_kg: 56.95, body_fat_pct: 27.5 },
  ],
  lastPeriodStart: '2026-09-27',
};

// A REAL THREAD, not two turns. turn_context reads the recent history and both
// calls carry it, so a probe with an empty history measures a call this app never
// makes.
function history(turns) {
  const out = [];
  for (let i = 0; i < turns / 2; i += 1) {
    out.push({ role: 'user', content: 'Had porridge with blueberries and a coffee with oat milk this morning' });
    out.push({
      role: 'assistant',
      content:
        'Porridge and blueberries is a proper start. How has the rest of the morning gone?',
    });
  }
  return out;
}

async function time(label, fn) {
  const times = [];
  let note = '';
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = Date.now();
    note = await fn();
    times.push(Date.now() - t0);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const min = sorted[0];
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(
    `  ${label.padEnd(44)} min ${String(min).padStart(5)}ms   median ${String(median).padStart(5)}ms   ${note}`
  );
  return { min, median };
}

const count = async (system, messages) =>
  (await anthropic.messages.countTokens({ model: MODEL, system, messages })).input_tokens;

console.log('\n  THE REPLY WRITER, AND WHAT MAKES IT SLOWER\n');
console.log(`  ${RUNS} runs each. The minimum is what the call costs when nothing else is`);
console.log('  going wrong; the gap to the median is how much of this is weather.\n');

const staticHalf = [replyPrompt(), SAFETY_PROMPT_BLOCK].join('\n\n');
const turnHalf = `THE RECORD:\n${turnFacts(DATA)}`;

const call = async ({ msgs, cache }) => {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: cache
      ? [
          { type: 'text', text: staticHalf, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: turnHalf },
        ]
      : `${staticHalf}\n\n${turnHalf}`,
    messages: msgs,
  });
  const u = res.usage;
  return `in ${u.input_tokens}${u.cache_read_input_tokens ? ` (+${u.cache_read_input_tokens} cached)` : ''} out ${u.output_tokens}`;
};

const HER_TURN = { role: 'user', content: '56.9 this morning' };

await time('as it ships now: 40 turns of history, cached', () =>
  call({ msgs: [...history(40), HER_TURN], cache: true })
);
await time('the same, with no cache breakpoint', () =>
  call({ msgs: [...history(40), HER_TURN], cache: false })
);
await time('history trimmed to 6 turns, cached', () =>
  call({ msgs: [...history(6), HER_TURN], cache: true })
);
await time('no history at all, cached', () => call({ msgs: [HER_TURN], cache: true }));

console.log('\n  WHAT EACH CONFIGURATION SENDS\n');
console.log(
  `    40 turns  ${await count(`${staticHalf}\n\n${turnHalf}`, [...history(40), HER_TURN])} tokens`
);
console.log(
  `     6 turns  ${await count(`${staticHalf}\n\n${turnHalf}`, [...history(6), HER_TURN])} tokens`
);
console.log(
  `        none  ${await count(`${staticHalf}\n\n${turnHalf}`, [HER_TURN])} tokens`
);

console.log('\n  A BASELINE, so the numbers above can be read at all\n');
await time('a trivial call, no system prompt, no history', async () => {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 40,
    messages: [{ role: 'user', content: 'Say hello in five words.' }],
  });
  return `out ${res.usage.output_tokens}`;
});

console.log('');
