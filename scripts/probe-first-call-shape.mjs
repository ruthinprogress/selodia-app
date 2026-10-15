// WHAT IS THE DECIDING CALL SPENDING ITS OUTPUT TOKENS ON?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-first-call-shape.mjs
//
// The first call of a led turn is routing: read the turn, fill in a tool. On
// her last twelve slow turns it produced between 327 and 1,401 output tokens,
// and output tokens are where the seconds are.
//
// A tool call is a hundred tokens or so. So the question is what the rest is -
// thinking, which cannot be turned off on this model (the API refuses
// thinking.type.disabled and effort is already at its floor), or TEXT, which
// is written and then thrown away because the reply is written by the second
// call. Text would be pure waste and worth removing.
//
// Prints the block types and their sizes. Read-only, invented messages.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { buildClassifyTool, SAFETY_PROMPT_BLOCK, CLASSIFY_TOOL_NAME } = await import(
  root + '/app/lib/safety-classification.ts'
);
const { LEAD_MODEL, LEAD_EFFORT, LEAD_FIRST_MAX_TOKENS } = await import(root + '/app/lib/lead-turn.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// replyIsFallback TRUE, which is what the route passes on every led turn:
// newPathWrites(isVoice) is true for typed and voice alike. The first version
// of this probe left it at its default of false, so it asked for a full reply
// and got one - 554 tokens - which is a fact about the probe, not the app.
const TOOL = buildClassifyTool(['neutral'], false, {
  logIntent: {
    type: 'string',
    enum: ['food', 'activity', 'measurement', 'hydration', 'sleep', 'none'],
    description: 'What this message logs, if anything.',
  },
  proposedSave: {
    type: 'object',
    description: 'Only when something here is worth OFFERING to keep.',
    properties: { type: { type: 'string', enum: ['me', 'care', 'week', 'note'] }, title: { type: 'string' } },
    required: ['type', 'title'],
  },
}, [], true);

const SYSTEM = [
  {
    type: 'text',
    text: [
      'You are Selodía, a calm health companion inside a body-literacy app used by women over 40.',
      'Read the turn and call the tool exactly once with the fields that apply.',
      '',
      SAFETY_PROMPT_BLOCK,
    ].join('\n'),
    cache_control: { type: 'ephemeral' },
  },
];

const SAYS = [
  'Porridge with blueberries and a coffee with oat milk for breakfast.',
  'Rang the insurer. Claim line 0800 000 001, authorisation CD2222, excess 100 pounds already paid.',
  'I just bought dumbbells that go up to 20kg. I want to build strength back in my legs, especially to support my knee. Can you build me a routine with videos of what I should do?',
];

for (const says of SAYS) {
  const started = Date.now();
  const message = await anthropic.messages.create({
    model: LEAD_MODEL,
    max_tokens: LEAD_FIRST_MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: says }],
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    output_config: { effort: LEAD_EFFORT },
  });

  console.log(`\n  "${says.slice(0, 60)}..."`);
  console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s, ${message.usage.output_tokens} output tokens`);
  if (message.usage.output_tokens_details) {
    console.log(`  details: ${JSON.stringify(message.usage.output_tokens_details)}`);
  }
  for (const block of message.content) {
    if (block.type === 'thinking') {
      console.log(`    thinking   ~${Math.round(block.thinking.length / 4)} tokens`);
    } else if (block.type === 'text') {
      console.log(`    TEXT       ~${Math.round(block.text.length / 4)} tokens  <-- written then discarded`);
      console.log(`               "${block.text.slice(0, 160).replace(/\n/g, ' ')}"`);
    } else if (block.type === 'tool_use') {
      console.log(`    tool_use   ~${Math.round(JSON.stringify(block.input).length / 4)} tokens  (${block.name === CLASSIFY_TOOL_NAME ? 'the classifier' : block.name})`);
      for (const [field, value] of Object.entries(block.input)) {
        const size = Math.round(JSON.stringify(value).length / 4);
        console.log(`      ${String(size).padStart(5)} tok  ${field}`);
      }
    } else {
      console.log(`    ${block.type}`);
    }
  }
}
console.log('');
