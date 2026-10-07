// DOES SOMETHING SHE IS MANAGING GET OFFERED?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-condition-offer.mjs
//
// The description is READ OUT OF route.ts rather than pasted, because a probe
// that tests a pasted string tests the paste. What is deployed is what is sent.
//
// FOUR OF THESE ARE THE PERMISSION AND THREE ARE THE LIMIT. A classifier that
// offers to file every passing ache as a managed condition would turn her Me tab
// into the symptom-and-diagnosis thread the whole Managed Conditions name exists
// to prevent.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const at = l.indexOf('=');
      return [l.slice(0, at), l.slice(at + 1).replace(/^["']|["']$/g, '')];
    })
);

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

function deployedDescription() {
  const start = route.indexOf("'Set ONLY when something in this turn is worth OFFERING");
  if (start < 0) throw new Error('the proposedSave description has moved');
  const end = route.indexOf('\n    },', start);
  const parts = route.slice(start, end).match(/'(?:[^'\\]|\\.)*'/g) ?? [];
  return parts.map((p) => p.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n')).join('');
}

const description = deployedDescription();
if (!/A CONDITION IS SOMETHING THEY ARE MANAGING/.test(description)) {
  throw new Error('the condition instruction is not in what was read');
}

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const TOOL = {
  name: 'classify',
  description: 'Read the turn and set only the fields that apply.',
  input_schema: { type: 'object', properties: { proposedSave: { type: 'object', description } } },
};

const CASES = [
  { name: 'IBS, the one she asked about', said: 'I have IBS so I have to be careful with some foods', want: 'condition', col: 'ibs' },
  { name: 'PCOS', said: 'I was diagnosed with PCOS a few years ago', want: 'condition', col: 'pcos' },
  { name: 'a condition with no column', said: 'I have pelvic congestion syndrome, it is a long story', want: 'condition', col: null },
  { name: 'getting seen about it', said: "I'm being investigated for endometriosis, I've got a referral", want: 'condition', col: null, status: 'Getting seen about it' },
  // THE LIMIT. None of these should become a managed condition.
  { name: 'a passing ache', said: 'my shoulder has been a bit sore since Tuesday', want: 'not condition' },
  { name: 'a test result, which is a marker', said: 'my iron came back low at my last blood test', want: 'marker' },
  { name: 'a decision about how to live', said: 'I have decided to take magnesium every night for my sleep', want: 'not condition' },
];

console.log('\n  SOMETHING SHE IS MANAGING, OR NOT\n');

let right = 0;
for (const c of CASES) {
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    tools: [TOOL],
    messages: [{ role: 'user', content: `THEY SAID: ${c.said}` }],
  });
  const ps = r.content.find((b) => b.type === 'tool_use')?.input?.proposedSave ?? null;
  const type = ps?.type ?? null;

  let ok;
  if (c.want === 'condition') ok = type === 'condition';
  else if (c.want === 'marker') ok = type === 'marker';
  else ok = type !== 'condition';
  if (ok) right += 1;

  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`        "${c.said}"`);
  console.log(`        ${ps ? JSON.stringify({ type, ...ps.content }) : 'offered nothing'}`);
  if (c.want === 'condition' && type === 'condition') {
    const got = ps.content?.condition;
    if (c.col && got !== c.col) console.log(`        note: column ${got}, expected ${c.col}`);
    if (c.status && ps.content?.status !== c.status) {
      console.log(`        note: status ${ps.content?.status}, expected ${c.status}`);
    }
  }
  console.log('');
}

console.log(`  ${right}/${CASES.length} as intended\n`);
process.exit(right === CASES.length ? 0 : 1);
