// WHAT A CHEAPER DECIDING MODEL BUYS, AND WHETHER IT COSTS THE DECISION.
//
//   node scripts/probe-split-models.mjs
//
// Ruth, 14 October 2026, on a led turn taking up to 28 seconds: "28seconds is
// not workable - work on solutions and report back."
//
// Measured in production the same day: the app's own work is 0.4 seconds of the
// turn, and the two model calls are the other 97%. Effort has already been tuned
// (medium 16.9s, low 11.3s, same answers - probe-lead-latency.mjs). What is left
// is the model itself.
//
// THE SPLIT UNDER TEST. The turn runs Opus 5.5 twice: once to DECIDE what the
// turn needs - routing and extraction, structured output against a tool - and
// once to WRITE the reply, which is the judgement she is paying for. Those are
// not the same job. This times the deciding call on Opus 5.5 against Sonnet 5
// and, more importantly, checks whether they decide the SAME THING.
//
// A FASTER WRONG DECISION IS NOT A WIN, so every run is checked on three
// things the turn depends on: that a tool call came back at all, that the entry
// was read as something worth keeping, and that the numbers in her message
// survived into the decision. Speed with any of those missing is a regression
// wearing a stopwatch.
//
// Three runs each, because one sample of a model call says nothing.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const DECIDERS = ['claude-opus-5-5', 'claude-sonnet-5'];
const RUNS = 3;
const EFFORT = 'low';

// Invented throughout, and shaped like the AXA turn that started this.
const SYSTEM = [
  {
    type: 'text',
    text: [
      'You are Selodía, a calm health companion inside an app. Address the person as "you".',
      'Read the turn and call the tool exactly once with the fields that apply.',
      'A care record is the paperwork of being seen: numbers, letters, routes back in.',
    ].join('\n'),
    cache_control: { type: 'ephemeral' },
  },
  {
    type: 'text',
    text: [
      'HOW THEY ACCESS CARE:',
      '- GP: Dr A Example, Example Road Surgery, 0200 000 0000.',
      '- Private cover: Example Health, membership EX123456.',
      'SYMPTOMS THEY LOGGED:',
      '- 12 Sept: left knee pain after exercise.',
      '- 4 Oct: left knee nearly gave way on the stairs.',
      'THEIR STANDING DETAILS:',
      '- NHS number: 000 000 0000',
    ].join('\n'),
    cache_control: { type: 'ephemeral' },
  },
];

const TOOLS = [
  {
    name: 'classify',
    description: 'Decide what this turn needs. Call once.',
    input_schema: {
      type: 'object',
      properties: {
        logIntent: { type: 'string', enum: ['food', 'activity', 'measurement', 'sleep', 'none'] },
        proposedSave: {
          type: 'object',
          description:
            'Only when something in this turn is worth OFFERING to keep. A care record is the paperwork of being seen.',
          properties: {
            type: { type: 'string', enum: ['me', 'care', 'week', 'note'] },
            title: { type: 'string' },
            content: { type: 'object', properties: { why: { type: 'string' }, detail: { type: 'string' } } },
          },
          required: ['type', 'title'],
        },
        standingDetails: {
          type: 'array',
          description: 'Details that stay the same and that somebody asks for to find them.',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, value: { type: 'string' } },
            required: ['label', 'value'],
          },
        },
      },
    },
    cache_control: { type: 'ephemeral' },
  },
];

const MESSAGE =
  'Claim follow-up number: 0800 000 001. Example Video Health will video call me at home and refer me to MRI if needed. Physio: 20 sessions a year, none used. CD2222 authorisation code. £100 excess already paid. My membership is EX123456.';

const MESSAGES = [{ role: 'user', content: MESSAGE }];

/** The three things the turn depends on, checked on every run. */
function judge(decision) {
  const text = JSON.stringify(decision ?? {});
  return {
    decided: decision !== null,
    offeredCare: decision?.proposedSave?.type === 'care',
    keptNumbers: text.includes('CD2222') && text.includes('0800 000 001'),
  };
}

const results = [];

for (const model of DECIDERS) {
  for (let run = 1; run <= RUNS; run += 1) {
    const started = Date.now();
    let message;
    try {
      message = await anthropic.messages.create({
        model,
        max_tokens: 8000,
        system: SYSTEM,
        messages: MESSAGES,
        tools: TOOLS,
        tool_choice: { type: 'auto' },
        output_config: { effort: EFFORT },
      });
    } catch (err) {
      console.log(`  ${model} run ${run}: REFUSED - ${err instanceof Error ? err.message : String(err)}`);
      results.push({ model, ms: null, failed: true });
      continue;
    }
    const ms = Date.now() - started;
    const use = message.content.find((b) => b.type === 'tool_use');
    const verdict = judge(use ? use.input : null);
    results.push({ model, ms, ...verdict, out: message.usage.output_tokens });
    console.log(
      `  ${model.padEnd(20)} run ${run}: ${(ms / 1000).toFixed(1)}s  ` +
        `${message.usage.output_tokens} out  ` +
        `decided:${verdict.decided ? 'Y' : 'n'} care:${verdict.offeredCare ? 'Y' : 'n'} numbers:${verdict.keptNumbers ? 'Y' : 'n'}`
    );
  }
}

console.log('\n  ---- the measure ----\n');
for (const model of DECIDERS) {
  const mine = results.filter((r) => r.model === model && r.ms !== null);
  if (mine.length === 0) {
    console.log(`  ${model.padEnd(20)} every run refused`);
    continue;
  }
  const avg = mine.reduce((s, r) => s + r.ms, 0) / mine.length / 1000;
  const out = Math.round(mine.reduce((s, r) => s + r.out, 0) / mine.length);
  const ok = mine.filter((r) => r.decided && r.offeredCare && r.keptNumbers).length;
  console.log(
    `  ${model.padEnd(20)} ${avg.toFixed(1)}s average, ${out} output tokens, ${ok}/${mine.length} fully correct`
  );
}

const opus = results.filter((r) => r.model === DECIDERS[0] && r.ms !== null);
const sonnet = results.filter((r) => r.model === DECIDERS[1] && r.ms !== null);
if (opus.length && sonnet.length) {
  const a = opus.reduce((s, r) => s + r.ms, 0) / opus.length;
  const b = sonnet.reduce((s, r) => s + r.ms, 0) / sonnet.length;
  console.log(
    `\n  Swapping the DECIDING call would save about ${((a - b) / 1000).toFixed(1)}s a turn ` +
      `(${(((a - b) / a) * 100).toFixed(0)}% of that call).`
  );
  console.log('  The reply call is unchanged and stays on Opus - that is the judgement she is paying for.\n');
}
