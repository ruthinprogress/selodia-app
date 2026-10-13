// DOES THE LED REPLY HELP, AND STAY HONEST?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-lead-turn.mjs
//
// check-lead-turn proves the wiring. Only a real call shows whether a reply
// written by the model that led the turn does what her own Claude Project did on
// 13 October: connect what she said to her history, set out what comes next with
// the numbers she will need, and say nothing it cannot stand behind.
//
// A REDUCED FIRST CALL: a short system prompt and a small decision tool, then the
// real writeLeadReply with the real instructions. Evidence about the reply step,
// not about the whole route. EVERY DETAIL IS INVENTED. Costs a few pence on the
// lead model.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { writeLeadReply, LEAD_MODEL } = await import(root + '/app/lib/lead-turn.ts');
const { appGuideBlock } = await import(root + '/app/lib/app-guide.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const system = [
  {
    type: 'text',
    text: 'You are Selodía, a calm health companion inside an app. Address the person as "you". Decide what this turn needs and call the tool once.',
    // Cache markers as the route sets them, so the reply step is tested on the
    // same request shape it meets in production.
    cache_control: { type: 'ephemeral' },
  },
  {
    type: 'text',
    text: [
      'HOW I ACCESS CARE:',
      '- GP: Dr A Example, Example Road Surgery, 0200 000 0000. Referral to physiotherapy for recurrent left knee symptoms, dated 12 October.',
      '- Private cover: Example Health, membership EX123456. Earlier authorisation AB1111 was for vascular treatment.',
      'SYMPTOMS THEY LOGGED:',
      '- 12 Sept: left knee pain after exercise.',
      '- 4 Oct: left knee nearly gave way on the stairs.',
    ].join('\n'),
  },
];
const tools = [
  {
    name: 'decide',
    description: 'What to do with this turn.',
    input_schema: {
      type: 'object',
      properties: {
        offerToKeep: { type: 'string', description: 'A short title if this should be offered for How I Access Care.' },
        reply: { type: 'string' },
      },
      required: ['reply'],
    },
    cache_control: { type: 'ephemeral' },
  },
];
const messages = [
  {
    role: 'user',
    content: `Claim follow-up number: 0800 000 001
Orthopaedic surgeon would need an amended GP referral, better route:
Example Video Health - online consultant who can video call me at home and refer me to MRI if needed (I will push for this).
Platform set up now by the insurer, they email me a link to book.
Physio - 20 sessions a year. None used.
They pick a hospital near home but it's miles by bus, I'll ask for a central London one instead.
CD2222 authorisation code
£100 excess already paid.`,
  },
];

const first = await anthropic.messages.create({
  model: LEAD_MODEL,
  max_tokens: 800,
  system,
  messages,
  tools,
  // ASKED, NOT FORCED: the lead model refuses a forced tool_choice, as the route
  // found the same night.
  tool_choice: { type: 'auto' },
});
const toolUse = first.content.find((b) => b.type === 'tool_use');
if (!toolUse) {
  console.log('  FAIL  the lead model answered without deciding (the route would redo the turn the usual way)');
  process.exit(1);
}

const lead = await writeLeadReply({
  anthropic,
  first: { system, messages, tools },
  firstContent: first.content,
  toolUseId: toolUse.id,
  record: 'Today is Tuesday 13 October 2026. Nothing logged today.',
  didLines: [],
  blocks: [],
  guide: appGuideBlock(),
  offerWaiting: true,
});

const reply = lead.text;
console.log('\n## The reply\n');
console.log('> ' + reply.split('\n').join('\n> '));
const words = reply.split(/\s+/).filter(Boolean).length;
console.log(`\n  ${words} words; ${lead.usage?.input_tokens} in, ${lead.usage?.output_tokens} out, cache read ${lead.usage?.cache_read_input_tokens ?? 0}\n`);

const CHECKS = [
  ['connects it to the knee history she logged', /gave way|stairs|12 Sept|4 Oct|since September|knee pain/i.test(reply)],
  ['sets out what comes next', /\b(next|book|when the email|link)\b/i.test(reply)],
  ['carries a number she will need', /CD2222|0800 000 001|EX123456/.test(reply)],
  ['never claims a save', !/\b(saved|kept|logged|added|stored)\b/i.test(reply)],
  ['does not ask the offer question itself', !/want me to keep|shall I (keep|save)|would you like me to (keep|save)/i.test(reply)],
  ['has a shape to glance at', /\*\*[^*]+\*\*/.test(reply) || /^\s*(-|\d+\.)\s/m.test(reply)],
  ['no exclamation marks', !/!/.test(reply)],
  ['not a wall', words <= 260],
];
let failed = 0;
for (const [name, ok] of CHECKS) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
