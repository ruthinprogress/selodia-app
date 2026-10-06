// DOES THE CLASSIFIER OFFER TO KEEP A RESULT SHE HAS BEEN GIVEN?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-marker-offer.mjs
//
// THE TURN THIS EXISTS FOR. 6 October 2026, 21:54. Ruth typed "my cholesterol was
// flagged at my NHS check-up" - the exact sentence written into the instruction
// as an example - and nothing offered to keep it.
//
// The cause was a contradiction inside one field description: the marker
// instruction at line 1875 and, eight lines below it, "Never for a plan, a
// passing remark, A PLAIN RESULT or a one-off observation". A plain result is
// precisely what a marker is, and the categorical last line won.
//
// SO THIS SENDS THE REAL DESCRIPTION, READ OUT OF route.ts, rather than a copy.
// A probe that tests a pasted string tests the paste. The point is whether the
// text that is actually deployed produces an offer.
//
// IT WRITES NOTHING AND TOUCHES NO ACCOUNT. One model call per case.

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

// THE DESCRIPTION AS DEPLOYED. Each line of it is a quoted fragment concatenated
// with +, so the fragments are pulled out and rejoined exactly as the route does.
function deployedDescription() {
  const start = route.indexOf("'Set ONLY when something in this turn is worth OFFERING");
  if (start < 0) throw new Error('the proposedSave description has moved');
  const end = route.indexOf('\n    },', start);
  const slice = route.slice(start, end);
  const parts = slice.match(/'(?:[^'\\]|\\.)*'/g) ?? [];
  return parts.map((p) => p.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n')).join('');
}

const description = deployedDescription();
if (!/MARKER/.test(description)) throw new Error('the marker instruction is not in what was read');

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const TOOL = {
  name: 'classify',
  description: 'Read the turn and set only the fields that apply.',
  input_schema: {
    type: 'object',
    properties: { proposedSave: { type: 'object', description } },
  },
};

const CASES = [
  { name: 'her sentence, exactly as she typed it', said: 'my cholesterol was flagged at my NHS check-up', want: 'marker', marker: 'cholesterol_status', status: 'elevated' },
  { name: 'iron came back low', said: 'my iron came back low at my last blood test', want: 'marker', marker: 'ferritin_status', status: 'low' },
  { name: 'a thyroid result that was fine', said: 'they said my thyroid came back normal', want: 'marker', marker: 'thyroid_status', status: 'normal' },
  { name: 'borderline HbA1c', said: 'the nurse said my HbA1c is borderline', want: 'marker', marker: 'glucose_status', status: 'borderline' },
  // NOT A MARKER, and the instruction has to keep telling them apart. A symptom
  // is something she feels; a marker is something somebody measured.
  { name: 'a symptom, not a result', said: 'I have been getting really tired in the afternoons', want: 'not marker' },
  // A ONE-OFF OBSERVATION. The closing rule still forbids this and must still
  // forbid it after tonight's edit, or the carve-out was too wide.
  { name: 'a passing remark', said: 'that pizza last night was enormous', want: 'nothing' },
];

console.log('\n  DOES A RESULT SHE HAS BEEN GIVEN GET OFFERED?\n');

let right = 0;
for (const c of CASES) {
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    tools: [TOOL],
    messages: [{ role: 'user', content: `THEY SAID: ${c.said}` }],
  });
  const use = r.content.find((b) => b.type === 'tool_use');
  const ps = use?.input?.proposedSave ?? null;
  const type = ps?.type ?? null;

  let ok;
  if (c.want === 'marker') ok = type === 'marker';
  else if (c.want === 'not marker') ok = type !== 'marker';
  else ok = ps == null;
  if (ok) right += 1;

  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`        "${c.said}"`);
  console.log(`        offered: ${ps ? JSON.stringify({ type, ...ps.content }) : 'nothing'}`);
  if (c.want === 'marker' && type === 'marker') {
    const m = ps.content?.marker;
    const s = ps.content?.status;
    const note = [];
    if (m !== c.marker) note.push(`column ${m}, expected ${c.marker}`);
    if (s !== c.status) note.push(`status ${s}, expected ${c.status}`);
    if (note.length) console.log(`        note: ${note.join('; ')}`);
  }
  console.log('');
}

console.log(`  ${right}/${CASES.length} as intended\n`);
process.exit(right === CASES.length ? 0 : 1);
