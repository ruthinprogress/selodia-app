// WHAT A WHOLE TURN CAN COST, AND WHETHER 3.3s IS REACHABLE AT ALL.
//
// Ruth wants voice back to about 3.3 seconds. The new path is two sequential
// model calls, so before optimising either of them it is worth knowing what they
// add up to - and whether the target is achievable in this shape or needs a
// different one.
//
// THE CLASSIFY CALL IS MEASURED AGAINST THE REAL CONDUCT BLOCK, read out of the
// route rather than copied, and with a tool of the real size. It is not the
// production call - the route assembles far more context around it - so this is a
// floor rather than a figure. A floor is what the question needs.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-turn-budget.mjs

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { buildClassifyTool } from '../app/lib/safety-classification.ts';
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
const MODEL = 'claude-sonnet-5';
const RUNS = 4;

// The deployed conduct block, extracted rather than copied so this cannot drift.
function currentConduct() {
  const src = fs.readFileSync(path.join(ROOT, 'app/api/ask-selodia/route.ts'), 'utf8');
  const m = /const GENERAL_CONDUCT = `/.exec(src);
  if (!m) return '';
  let j = m.index + m[0].length;
  const out = [];
  while (j < src.length) {
    if (src[j] === '\\') {
      out.push(src.slice(j, j + 2));
      j += 2;
    } else if (src[j] === '`') break;
    else out.push(src[j++]);
  }
  return out.join('');
}

const CONDUCT = currentConduct();

const HISTORY = [
  { role: 'user', content: 'Had porridge with blueberries and a coffee with oat milk' },
  { role: 'assistant', content: 'Porridge and blueberries is a proper start to a cold morning.' },
  { role: 'user', content: 'Chicken salad and a flat white for lunch' },
  { role: 'assistant', content: 'A solid lunch. How is the afternoon looking?' },
  { role: 'user', content: 'Did the barbell routine last night, skipped the deadlifts' },
  { role: 'assistant', content: 'Noted on the deadlifts. How did the rest of it feel?' },
  { role: 'user', content: '56.9 this morning' },
];

const DATA = {
  days: 7,
  food: [{ happened_at: '2026-09-27T20:04:00Z', raw_text: 'lamb pizza, half a lager', kcal: 2068, protein_g: 72.9 }],
  activity: [],
  dailyBurn: [{ date: '2026-09-27', steps: 8391, kcal_burned: null, active_minutes: null }],
  drinks: [],
  sleep: [],
  measurements: [
    { measured_at: '2026-09-27T07:58:00Z', weight_kg: 56.85, body_fat_pct: 27.4 },
    { measured_at: '2026-09-28T07:41:00Z', weight_kg: 56.95, body_fat_pct: 27.5 },
  ],
  lastPeriodStart: '2026-09-27',
};

async function timed(label, fn) {
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
  console.log(`  ${label.padEnd(40)} min ${String(min).padStart(5)}ms   median ${String(median).padStart(5)}ms   ${note}`);
  return { min, median };
}

async function classify(replyIsFallback) {
  const tool = buildClassifyTool(['neutral'], false, {}, [], replyIsFallback);
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: [{ type: 'text', text: CONDUCT, cache_control: { type: 'ephemeral' } }],
    messages: HISTORY,
    tools: [{ ...tool, cache_control: { type: 'ephemeral' } }],
    tool_choice: { type: 'tool', name: tool.name },
  });
  return `out ${res.usage.output_tokens}`;
}

console.log('\n  THE TWO HALVES OF A TURN\n');
console.log(`  ${RUNS} runs each. The classify call is measured against the real conduct`);
console.log('  block with caching on, which is a FLOOR: production assembles more.\n');

const full = await timed('classify, reply written in full', () => classify(false));
const fallback = await timed('classify, reply asked as a fallback', () => classify(true));
const writer = await timed('the reply writer, nothing to report', async () => {
  const r = await writeReplyAfterSaves({
    anthropic,
    model: MODEL,
    messages: HISTORY,
    data: DATA,
    voice: false,
    didLines: [],
    safetyBlock: SAFETY_PROMPT_BLOCK,
  });
  return r.fellBack === null ? `out ~${Math.round(r.text.length / 4)}` : `FELL BACK: ${r.fellBack}`;
});

console.log('\n  WHAT THAT MEANS FOR HER 3.3 SECONDS\n');
const sequential = fallback.median + writer.median;
const speculative = Math.max(fallback.median, writer.median);
console.log(`    sequential, as it ships now       ${sequential}ms`);
console.log(`    if the two ran at the same time   ${speculative}ms`);
console.log('');
console.log('  The old path was one call and measured 3.3s on her real turns. Two calls');
console.log('  in sequence cannot beat that unless each is well under half of it, so the');
console.log('  question is whether they have to be in sequence at all - and on a turn');
console.log('  with nothing for the app to report, the writer needs nothing the');
console.log('  classifier produces.\n');
