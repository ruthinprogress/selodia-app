// WHERE THE EIGHT SECONDS GO.
//
// measure-voice-turn.mjs times the whole round trip through production and
// cannot see inside it. This isolates the one call that dominates it: the
// Sonnet request with the real system prompt and the real tool schema, made
// three ways, so the question "would streaming help, and would caching" has a
// number rather than an opinion.
//
//   plain     non-streaming, no cache. What production does today.
//   stream    streaming, no cache. Measures time to the first REPLY character.
//   cached    streaming with the static prefix cached.
//
// The user message is deliberately ordinary. A question that makes the model
// write a workout plan would measure the worst case, and the worst case is not
// what she hears when she says what she ate.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

// THE PROMPT IS READ OUT OF THE ROUTE, NOT COPIED BESIDE IT. A checked-in copy
// of a 15,000-token prompt is a second source of truth that goes stale the
// first time the real one is edited, and then this measures something the app
// no longer sends. Sliced fresh on every run, by line, because both the prompt
// and the tool schema are plain literals in the source.
async function shapeFromRoute() {
  const src = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\n');
  const lineOf = (needle) => {
    for (let i = 0; i < src.length; i++) if (src[i].includes(needle)) return i + 1;
    throw new Error(`probe cannot find "${needle}" in the route - has it been renamed?`);
  };
  const slice = (a, b) => src.slice(a - 1, b).join('\n');

  const sysStart = lineOf('const SYSTEM_PROMPT');
  const splitAt = lineOf('const staticSystemPrompt');
  const toolStart = lineOf('const tool = buildClassifyTool');
  const afterTool = lineOf('let response;');

  let toolEnd = toolStart;
  for (let i = toolStart; i < afterTool; i++) {
    if (src[i - 1].trim() === '});') {
      toolEnd = i;
      break;
    }
  }

  // The object literal is pure data, so it is valid JavaScript as it stands.
  // Written to a temp module rather than eval'd, so a syntax error points at a
  // real file and a real line.
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

const ROOT = process.cwd();
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const anthropic = new Anthropic({ apiKey: E.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

// Rebuilt to match buildClassifyTool's output: classification first, reply
// second, then everything the route adds. The ORDER is the point - a model
// emits tool JSON in schema order, so what sits in front of `reply` is what
// has to be generated before a single word can be spoken.
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
  { type: 'text', text: `\n\nTODAY IS Thursday 24 September 2026. They have logged 445 kcal so far.` },
];

const messages = [{ role: 'user', content: 'I had porridge with blueberries and a coffee' }];

/** Time to first reply character, and to the end. */
async function streamed({ cache }) {
  const sys = cache
    ? [{ ...system[0], cache_control: { type: 'ephemeral' } }, system[1]]
    : system;
  const tools = cache ? [{ ...tool, cache_control: { type: 'ephemeral' } }] : [tool];

  const t0 = performance.now();
  let firstReplyAt = null;
  let json = '';
  let usage = null;

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    system: sys,
    messages,
    tools,
    tool_choice: { type: 'tool', name: 'classify_and_reply' },
  });

  stream.on('streamEvent', (event) => {
    if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
      json += event.delta.partial_json;
      // The first moment a character of the reply STRING exists. Everything
      // before this is classification, which is never spoken.
      if (firstReplyAt === null) {
        const at = json.indexOf('"reply"');
        if (at >= 0) {
          const opened = json.indexOf('"', json.indexOf(':', at) + 1);
          if (opened >= 0 && json.length > opened + 1) firstReplyAt = performance.now() - t0;
        }
      }
    }
  });

  const final = await stream.finalMessage();
  usage = final.usage;
  const block = final.content.find((b) => b.type === 'tool_use');
  return {
    firstReply: firstReplyAt,
    total: performance.now() - t0,
    replyChars: (block?.input?.reply ?? '').length,
    outputTokens: usage.output_tokens,
    inputTokens: usage.input_tokens,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
  };
}

async function plain() {
  const t0 = performance.now();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'classify_and_reply' },
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  return {
    total: performance.now() - t0,
    replyChars: (block?.input?.reply ?? '').length,
    outputTokens: res.usage.output_tokens,
    inputTokens: res.usage.input_tokens,
  };
}

const ms = (n) => (n == null ? '   -  ' : `${Math.round(n)}ms`.padStart(7));

console.log('\n  ONE SONNET TURN, THE REAL PROMPT AND THE REAL TOOL\n');

for (let i = 1; i <= 2; i++) {
  const p = await plain();
  console.log(`  plain  ${i}   total ${ms(p.total)}   in ${p.inputTokens}  out ${p.outputTokens}  reply ${p.replyChars} chars`);
}

for (let i = 1; i <= 2; i++) {
  const s = await streamed({ cache: false });
  console.log(`  stream ${i}   first reply char ${ms(s.firstReply)}   total ${ms(s.total)}   in ${s.inputTokens}  out ${s.outputTokens}`);
}

// Twice: the first writes the cache, the second reads it.
for (let i = 1; i <= 3; i++) {
  const c = await streamed({ cache: true });
  console.log(
    `  cached ${i}   first reply char ${ms(c.firstReply)}   total ${ms(c.total)}   write ${c.cacheWrite}  read ${c.cacheRead}  out ${c.outputTokens}`
  );
}

console.log('');
