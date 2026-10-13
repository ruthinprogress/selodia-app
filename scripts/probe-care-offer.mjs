// DOES CARE INFORMATION SHE TYPES IN GET OFFERED, AND DOES THE OFFER SURVIVE?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-care-offer.mjs
//
// Ruth, 13 October 2026 (Session 71): she typed out what her insurer told her on
// the phone - a claim line, a better route to a consultant, a physio allowance,
// an authorisation code, the excess paid. The reply offered to keep it as a care
// record in its own words. She said yes, twice, and both times the app said
// "That did not save". No offer had been stored: the app's own question, "Want me
// to keep that in How I Access Care?", never appeared.
//
// Two possibilities, and this separates them: the model never proposed, or it
// proposed something coerceProposal refused. Both halves run on the deployed
// description, read out of route.ts.
//
// EVERY DETAIL BELOW IS INVENTED. A few pence.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { coerceProposal } = await import(root + '/app/lib/pending-save.ts');

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

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\r\n').join('\n');

function deployedDescription() {
  const start = route.indexOf("'Set ONLY when something in this turn is worth OFFERING");
  if (start < 0) throw new Error('the proposedSave description has moved');
  const end = route.indexOf('\n    },', start);
  const slice = route.slice(start, end);
  const parts = slice.match(/'(?:[^'\\]|\\.)*'/g) ?? [];
  return parts.map((p) => p.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n')).join('');
}

const description = deployedDescription();
if (!/A CARE RECORD IS WHAT THEY NEED/.test(description)) throw new Error('the care instruction is not in what was read');

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const TOOL = {
  name: 'classify',
  description: 'Read the turn and set only the fields that apply.',
  input_schema: { type: 'object', properties: { proposedSave: { type: 'object', description } } },
};

const INSURER = `Claim reference followup number: 0800 000 000
Orthopaedic surgeon needs amended GP referral, better route:
Example Health - online consultant that can video call me at home and then refer me to MRI if needed. Skips the multi trips.
Platform set up now by the insurer, emails me. Follow link, book appointment and video call.
Physio - 20 session allowance per year. None ever used before.
AB1234 authorisation code
£100 excess already paid.`;

const CASES = [
  { name: 'what her insurer told her, typed out', said: INSURER, want: 'care' },
  { name: 'a practice and its booking system, told directly', said: 'My GP is Example Road Surgery, you book through their online form, the number is 0200 000 0000', want: 'care' },
  { name: 'a passing remark about a clinic', said: 'the waiting room at the clinic was freezing today', want: 'nothing' },
];

console.log('\n  DOES CARE INFORMATION SHE TYPES GET OFFERED, AND KEPT?\n');

let right = 0;
for (const c of CASES) {
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 900,
    tools: [TOOL],
    messages: [{ role: 'user', content: `THEY SAID: ${c.said}` }],
  });
  const use = r.content.find((b) => b.type === 'tool_use');
  const ps = use?.input?.proposedSave ?? null;
  const coerced = ps ? coerceProposal(ps) : null;
  const type = coerced?.type ?? null;
  // Judged on what she would SEE: an offer only exists once it survives.
  const ok = c.want === 'care' ? type === 'care' : coerced == null;
  if (ok) right += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`        proposed: ${ps ? JSON.stringify(ps).slice(0, 300) : 'nothing'}`);
  console.log(`        survived coerceProposal: ${coerced ? 'yes, as ' + coerced.type : ps ? 'NO - refused' : '-'}`);
  console.log('');
}

console.log(`  ${right}/${CASES.length} as intended\n`);
process.exit(right === CASES.length ? 0 : 1);
