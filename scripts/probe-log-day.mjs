// DOES THE MODEL ACTUALLY HAND OVER THE DAY? check-log-day proves the wiring;
// only a real call proves the field description works. A few pence.
//
//   node scripts/probe-log-day.mjs
//
// The descriptions are read out of route.ts, so this tests the words that ship.
// It is a reduced prompt, not the whole classifier: evidence that the field is
// understood, not proof the full turn sets it.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');

function descriptionOf(field) {
  const start = route.indexOf(`    ${field}: {\n`) >= 0 ? route.indexOf(`    ${field}: {\n`) : route.indexOf(`    ${field}: {\r\n`);
  const chunk = route.slice(start, start + 4000);
  const m = chunk.match(/description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error(`no description for ${field}`);
  return JSON.parse(`"${m[1]}"`);
}

const tool = {
  name: 'classify',
  description: 'Classify the turn.',
  input_schema: {
    type: 'object',
    properties: {
      logIntent: { type: 'string', enum: ['none', 'food', 'activity'] },
      logText: { type: 'string', description: descriptionOf('logText') },
      logDate: { type: 'string', description: descriptionOf('logDate') },
    },
    required: ['logIntent'],
  },
};
const system =
  'You classify one turn of a conversation in a food and activity tracking app. ' +
  'WHAT DAY IT IS: today is Monday 12 October 2026 (2026-10-12). Use this whenever you have to turn a day somebody named into an actual date.';

const CASES = [
  {
    name: 'Friday named a turn earlier',
    want: '2026-10-09',
    messages: [
      { role: 'user', content: "I'm catching up on my food logs, I need to add more into Friday" },
      { role: 'assistant', content: 'Of course. What else did you have on Friday?' },
      { role: 'user', content: 'I had a pizza for dinner with salami - homemade pizza' },
    ],
  },
  {
    name: 'no day anywhere',
    want: null,
    messages: [{ role: 'user', content: 'I had a pizza for dinner with salami - homemade pizza' }],
  },
  {
    name: 'yesterday, in the message',
    want: '2026-10-11',
    messages: [{ role: 'user', content: 'Yesterday I had porridge for breakfast' }],
  },
];

let failed = 0;
for (const c of CASES) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 400,
    system,
    messages: c.messages,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'classify' },
  });
  const v = res.content.find((b) => b.type === 'tool_use')?.input ?? {};
  const got = v.logDate ?? null;
  const ok = got === c.want && v.logIntent === 'food';
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}: logDate=${got} logIntent=${v.logIntent} logText=${JSON.stringify(v.logText ?? null)}`);
}
if (failed) process.exit(1);
