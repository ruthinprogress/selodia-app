// HOW LONG A LED TURN TAKES, AND WHAT EFFORT BUYS BACK.
//
//   node scripts/probe-lead-latency.mjs
//
// Ruth, 14 October 2026, reading that a led turn takes 20 to 30 seconds: "That
// is broken by any normal users standards, including my own." She is right. The
// run that morning measured 12 to 24 seconds against 6 to 7 on the old chat,
// split about evenly between deciding and replying.
//
// Both halves are slow for one reason: the model thinks first, and nothing told
// it not to. Effort is the calibrated control for that (output_config.effort;
// Opus 5.5 defaults to medium, low "minimizes thinking... where speed matters
// most"). This times the two levels on one realistic turn, three runs each,
// because one sample of a model call says nothing.
//
// IT MEASURES QUALITY TOO, crudely but honestly: a faster reply that drops the
// numbers she needs is not a win, so each run is checked for the reference it
// was supposed to carry.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { LEAD_MODEL } = await import(root + '/app/lib/lead-turn.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Invented details, shaped like the turn that prompted this.
const SYSTEM = [
  {
    type: 'text',
    text: 'You are Selodía, a calm health companion inside an app. Address the person as "you". Decide what this turn needs and call the tool once.',
    cache_control: { type: 'ephemeral' },
  },
  {
    type: 'text',
    text: [
      'HOW I ACCESS CARE:',
      '- GP: Dr A Example, Example Road Surgery, 0200 000 0000.',
      '- Private cover: Example Health, membership EX123456.',
      'SYMPTOMS THEY LOGGED:',
      '- 12 Sept: left knee pain after exercise.',
      '- 4 Oct: left knee nearly gave way on the stairs.',
    ].join('\n'),
    cache_control: { type: 'ephemeral' },
  },
];
const TOOLS = [
  {
    name: 'decide',
    description: 'What to do with this turn.',
    input_schema: {
      type: 'object',
      properties: { offerToKeep: { type: 'string' }, reply: { type: 'string' } },
      required: ['reply'],
    },
    cache_control: { type: 'ephemeral' },
  },
];
const MESSAGES = [
  {
    role: 'user',
    content:
      'Claim follow-up number: 0800 000 001. Example Video Health will video call me at home and refer me to MRI if needed. Physio: 20 sessions a year, none used. CD2222 authorisation code. £100 excess already paid.',
  },
];

async function oneTurn(effort) {
  const started = Date.now();
  const cfg = effort ? { output_config: { effort } } : {};

  const first = await anthropic.messages.create({
    model: LEAD_MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: MESSAGES,
    tools: TOOLS,
    tool_choice: { type: 'auto' },
    ...cfg,
  });
  const decided = Date.now() - started;
  const use = first.content.find((b) => b.type === 'tool_use');
  if (!use) return { failed: 'no decision' };

  const reply = await anthropic.messages.create({
    model: LEAD_MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    messages: [
      ...MESSAGES,
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: use.id,
            content:
              'WHAT THE APP DID: nothing was written. AN OFFER IS WAITING.\n\nNow write your reply to them. Set out what comes next, with the numbers they will need, connected to what you know about them. Short labels in **double asterisks** and lines starting "- " where it helps. Under 180 words. Never say anything was saved.',
          },
        ],
      },
    ],
    tools: TOOLS,
    tool_choice: { type: 'none' },
    ...cfg,
  });
  const total = Date.now() - started;
  const text = reply.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return {
    decided,
    replyStep: total - decided,
    total,
    words: text.split(/\s+/).filter(Boolean).length,
    carriesTheCode: /CD2222/.test(text),
    usesHistory: /knee|stairs|gave way/i.test(text),
    thinking:
      (first.usage?.output_tokens_details?.thinking_tokens ?? 0) +
      (reply.usage?.output_tokens_details?.thinking_tokens ?? 0),
  };
}

const RUNS = 3;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(`\n  A LED TURN ON ${LEAD_MODEL}, ${RUNS} runs per level\n`);
for (const effort of [null, 'low']) {
  const label = effort ?? 'medium (the default)';
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await oneTurn(effort);
    if (r.failed) {
      console.log(`  ${label}: ${r.failed}`);
      continue;
    }
    runs.push(r);
    console.log(
      `  ${label.padEnd(20)} run ${i + 1}: ${(r.total / 1000).toFixed(1)}s ` +
        `(decide ${(r.decided / 1000).toFixed(1)}s, reply ${(r.replyStep / 1000).toFixed(1)}s), ` +
        `${r.thinking} thinking tokens, ${r.words} words` +
        `${r.carriesTheCode ? '' : ', LOST THE CODE'}${r.usesHistory ? '' : ', NO HISTORY'}`
    );
  }
  if (runs.length > 0) {
    console.log(
      `  ${label.padEnd(20)} MEDIAN ${(median(runs.map((r) => r.total)) / 1000).toFixed(1)}s, ` +
        `${median(runs.map((r) => r.thinking))} thinking tokens, ` +
        `${runs.filter((r) => r.carriesTheCode && r.usesHistory).length}/${runs.length} kept the code and the history\n`
    );
  }
}
