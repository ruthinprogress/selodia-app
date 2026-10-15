// DOES THE SECOND CALL OF A LED TURN RE-READ THE PREFIX, OR REMEMBER IT?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-cache-reuse.mjs
//
// Ruth, 15 October 2026: "latency next". Of a 17.0s turn, 15.5s is the two
// model calls, so the only question worth asking is what they read and write.
//
// A led turn sends the same prefix twice - the reply step spreads the first
// call's messages and appends to it. Three cache breakpoints were in use (the
// tool schema, the static prompt, her own context) and everything after them
// was arriving fresh both times: this turn's state, her week, the conversation
// itself. On her slow turns that is 8,675 input tokens, paid twice.
//
// This makes the same pair of calls both ways and prints what the API says
// about the cache, which is the only evidence that settles it. The numbers
// come from usage, not from a stopwatch, because a stopwatch on a shared API
// measures the weather as much as the change.
//
// Read-only. Invented content throughout.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { buildClassifyTool, SAFETY_PROMPT_BLOCK, CLASSIFY_TOOL_NAME } = await import(
  root + '/app/lib/safety-classification.ts'
);
const { LEAD_MODEL, LEAD_EFFORT, LEAD_FIRST_MAX_TOKENS, LEAD_REPLY_MAX_TOKENS } = await import(
  root + '/app/lib/lead-turn.ts'
);

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const TOOL = buildClassifyTool(
  ['neutral'],
  false,
  { logIntent: { type: 'string', enum: ['food', 'activity', 'none'], description: 'What this message logs.' } },
  [],
  true
);

// Padding that stands in for the turn-variable part of her prompt - the week,
// the day state, the pending save. Invented, and long enough to be worth
// caching (the minimum cacheable prefix is about a thousand tokens).
const filler = (label, n) =>
  Array.from({ length: n }, (_, i) => `${label} line ${i + 1}: nothing here is real, it is here to take up room.`).join('\n');

const STATIC = `You are Selodía, a calm health companion inside a body-literacy app used by women over 40.\n\n${filler('standing', 200)}\n\n${SAFETY_PROMPT_BLOCK}`;
const PERSON = filler('about them', 200);
const TURN_REST = `${filler('this turn', 200)}\n\nRESPOND BY CALLING THE ${CLASSIFY_TOOL_NAME} TOOL, EXACTLY ONCE.`;

const HISTORY = [
  { role: 'user', content: 'Morning. Porridge and a coffee.' },
  { role: 'assistant', content: 'Noted.' },
  { role: 'user', content: filler('earlier in the conversation', 120) },
  { role: 'assistant', content: 'Understood, that is all on file.' },
];

const system = [
  { type: 'text', text: STATIC, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: PERSON, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: TURN_REST },
];
const tools = [{ ...TOOL, cache_control: { type: 'ephemeral' } }];

/** The last message, with or without the fourth breakpoint on it. */
function messagesFor(marked) {
  const says = 'Scrambled eggs on toast this morning, and the hospital rang with a date.';
  return [
    ...HISTORY,
    marked
      ? { role: 'user', content: [{ type: 'text', text: says, cache_control: { type: 'ephemeral' } }] }
      : { role: 'user', content: says },
  ];
}

async function ledTurn(marked) {
  const messages = messagesFor(marked);

  const t1 = Date.now();
  const first = await anthropic.messages.create({
    model: LEAD_MODEL,
    max_tokens: LEAD_FIRST_MAX_TOKENS,
    system,
    messages,
    tools,
    tool_choice: { type: 'auto' },
    output_config: { effort: LEAD_EFFORT },
  });
  const firstMs = Date.now() - t1;

  const use = first.content.find((b) => b.type === 'tool_use');
  if (!use) return { failed: 'the first call did not call the tool' };

  const t2 = Date.now();
  const second = await anthropic.messages.create({
    model: LEAD_MODEL,
    max_tokens: LEAD_REPLY_MAX_TOKENS,
    system,
    tools,
    tool_choice: { type: 'none' },
    output_config: { effort: LEAD_EFFORT },
    messages: [
      ...messages,
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: use.id, content: 'Logged the eggs. Nothing else was done.' }],
      },
    ],
  });
  const secondMs = Date.now() - t2;

  return { first: first.usage, firstMs, second: second.usage, secondMs };
}

const show = (label, r) => {
  if (r.failed) return console.log(`  ${label}: FAILED ${r.failed}`);
  const line = (what, u, ms) =>
    `    ${what.padEnd(12)} fresh ${String(u.input_tokens).padStart(6)}   ` +
    `cache read ${String(u.cache_read_input_tokens ?? 0).padStart(6)}   ` +
    `cache written ${String(u.cache_creation_input_tokens ?? 0).padStart(6)}   ${(ms / 1000).toFixed(1)}s`;
  console.log(`\n  ${label}`);
  console.log(line('first call', r.first, r.firstMs));
  console.log(line('reply call', r.second, r.secondMs));
};

// WARM THE CACHE FIRST. The very first run of either arm writes the shared
// prefix and would be charged for work the other arm then gets free, which
// would make whichever ran first look worse for no reason.
console.log('\n  warming the shared prefix...');
await ledTurn(false);

// THREE RUNS AN ARM, INTERLEAVED. One run of each measured the weather: the
// first attempt showed the cached arm SLOWER, which is within the spread of a
// shared API and would have been a silly thing to ship or to reject on.
const RUNS = 3;
const arms = { false: [], true: [] };
for (let i = 0; i < RUNS; i += 1) {
  arms.false.push(await ledTurn(false));
  arms.true.push(await ledTurn(true));
}
const without = arms.false[0];
const with4th = arms.true[0];

show('three breakpoints (before)', without);
show('four breakpoints (after)', with4th);

console.log(`\n  ---- over ${RUNS} runs an arm ----`);
for (const [marked, label] of [['false', 'three breakpoints'], ['true', 'four breakpoints']]) {
  const rs = arms[marked].filter((r) => !r.failed);
  const avg = (f) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  console.log(
    `  ${label.padEnd(18)} first ${(avg((r) => r.firstMs) / 1000).toFixed(1)}s   ` +
      `reply ${(avg((r) => r.secondMs) / 1000).toFixed(1)}s   ` +
      `turn ${(avg((r) => r.firstMs + r.secondMs) / 1000).toFixed(1)}s   ` +
      `reply reads ${Math.round(avg((r) => r.second.input_tokens))} fresh`
  );
}

if (!without.failed && !with4th.failed) {
  const freshBefore = without.second.input_tokens;
  const freshAfter = with4th.second.input_tokens;
  console.log(
    `\n  The reply call reads ${freshBefore} fresh tokens on three breakpoints and ${freshAfter} on four` +
      ` - ${freshBefore - freshAfter} fewer.\n`
  );
  console.log(
    freshAfter < freshBefore
      ? '  The fourth breakpoint is doing something.\n'
      : '  THE FOURTH BREAKPOINT CHANGED NOTHING. Do not ship it on this evidence.\n'
  );
}
