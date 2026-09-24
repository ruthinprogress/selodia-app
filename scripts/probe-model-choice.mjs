// WHAT WOULD A LIGHTER MODEL ACTUALLY BUY ON A VOICE TURN?
//
// ElevenLabs' recommendation (24 September) was to run voice turns on a
// lighter model. That is worth doing only if the saving is real on OUR prompt,
// which is 21,000 tokens of instructions and context against an output of
// about 150 - so the turn may well be bound by reading rather than writing,
// and a faster writer would save nothing.
//
// Same system prompt, same tool schema, same question, three ways:
//
//   sonnet            what production runs today
//   sonnet + cache    with the tool schema cached, as production now does
//   haiku  + cache    the lighter model on the identical input
//
// It also prints the REPLY each one produced, because a model that answers in
// half the time and answers worse is not a saving. Read them.
//
//   node scripts/probe-model-choice.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

async function shapeFromRoute() {
  const src = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\n');
  const lineOf = (needle) => {
    for (let i = 0; i < src.length; i++) if (src[i].includes(needle)) return i + 1;
    throw new Error(`probe cannot find "${needle}" in the route - has it been renamed?`);
  };
  const slice = (a, b) => src.slice(a - 1, b).join('\n');

  const sysStart = lineOf('const SYSTEM_PROMPT');
  const splitAt = lineOf('const contextualSystemPrompt');
  const toolStart = lineOf('const tool = buildClassifyTool');
  const afterTool = lineOf('let response;');

  let toolEnd = toolStart;
  for (let i = toolStart; i < afterTool; i++) {
    if (src[i - 1].trim() === '});') {
      toolEnd = i;
      break;
    }
  }

  const tmp = path.join(os.tmpdir(), `selodia-shape-${process.pid}.mjs`);
  fs.writeFileSync(
    tmp,
    `export const promptText = ${JSON.stringify(slice(sysStart, splitAt - 1))};\n` +
      `export const extraProperties = {\n${slice(toolStart + 1, toolEnd - 1)}\n};\n`
  );
  try {
    return await import(`file://${tmp.split(path.sep).join('/')}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const { promptText, extraProperties } = await shapeFromRoute();

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const anthropic = new Anthropic({ apiKey: E.ANTHROPIC_API_KEY });

const DISTRESS_TIERS = [
  'ambiguous_distress',
  'eating_related_distress',
  'grief_related_distress',
  'acute_crisis',
];

const tool = {
  name: 'classify_and_reply',
  description: "Classify the user's message and generate your response",
  input_schema: {
    type: 'object',
    properties: {
      classification: { type: 'string', enum: ['neutral', ...DISTRESS_TIERS] },
      reply: { type: 'string', description: 'Your natural-language response, following the language rules exactly' },
      resourceCardTitle: { type: 'string', description: 'Only for distress classifications' },
      resourceCardDescription: { type: 'string', description: 'Only for distress classifications' },
      revisitingPriorDisclosure: { type: 'boolean', description: 'Returning to an earlier distress disclosure' },
      acuteExplicitIntent: { type: 'boolean', description: 'Explicit stated intent, acute_crisis only' },
      ...extraProperties,
    },
    required: ['classification', 'reply'],
  },
};

const system = [
  { type: 'text', text: promptText },
  { type: 'text', text: '\n\nTODAY IS Thursday 24 September 2026. They have logged 1290 kcal so far.' },
];

// An ordinary logging turn, which is what almost every voice turn is.
const messages = [{ role: 'user', content: 'I had a feta and mackerel salad for lunch and an egg for breakfast' }];

async function run(model, { cache }) {
  const tools = cache ? [{ ...tool, cache_control: { type: 'ephemeral' } }] : [tool];
  const t0 = performance.now();
  const res = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    system,
    messages,
    tools,
    tool_choice: { type: 'tool', name: 'classify_and_reply' },
  });
  const took = performance.now() - t0;
  const block = res.content.find((b) => b.type === 'tool_use');
  const input = block?.input ?? {};
  return {
    took,
    classification: input.classification,
    reply: input.reply ?? '',
    logged: Object.keys(input).filter((k) => !['classification', 'reply'].includes(k)),
    usage: res.usage,
  };
}

const CASES = [
  ['sonnet, no cache  ', 'claude-sonnet-5', { cache: false }],
  ['sonnet, cached    ', 'claude-sonnet-5', { cache: true }],
  ['haiku,  cached    ', 'claude-haiku-4-5-20251001', { cache: true }],
];

console.log('\n  THE SAME VOICE TURN, THREE WAYS\n');

for (const [label, model, opts] of CASES) {
  // Twice: the first may be writing the cache, which is not the steady state.
  try {
    await run(model, opts);
  } catch {
    /* the warm-up's failure is reported by the real run below */
  }
  try {
    const r = await run(model, opts);
    console.log(
      `  ${label} ${String(Math.round(r.took)).padStart(6)}ms   ` +
        `in ${r.usage.input_tokens} cache-read ${r.usage.cache_read_input_tokens ?? 0} out ${r.usage.output_tokens}`
    );
    console.log(`        classification: ${r.classification}`);
    console.log(`        fields set    : ${r.logged.join(', ') || '(none)'}`);
    console.log(`        reply         : ${r.reply.slice(0, 150)}`);
    console.log('');
  } catch (err) {
    console.log(`  ${label} FAILED: ${err instanceof Error ? err.message : err}\n`);
  }
}
