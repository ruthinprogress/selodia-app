// ONE REAL DRAFT, AGAINST INVENTED DETAILS, BEFORE IT REACHES A PHONE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-draft.mjs
//
// check-drafts proves the wiring. It cannot prove the model keeps to a stated
// character limit, leaves gaps instead of inventing a date, or keeps out of
// diagnosis - only a real call can. Costs one model call, a few pence.
//
// EVERY DETAIL BELOW IS INVENTED. No real person, practice or reference number:
// a probe that used Ruth's own record would send her medical history to the API
// to test a prompt, and the fixture would then be her data sitting in a repo.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { writeDraft } = await import(root + '/app/lib/draft.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const LIMIT = 600;

const draft = await writeDraft({
  anthropic,
  model: 'claude-sonnet-5',
  request: 'a message to their GP asking for a physio referral for their left knee',
  messages: [
    {
      role: 'user',
      content:
        'Can you write a message to my GP asking for a physio referral for my left knee? It went during a dance class, a pulling feeling at the back.',
    },
  ],
  contextBlocks: [
    `HOW I ACCESS CARE:\n- GP: Dr Example, Sample Street Surgery. Contacted through the practice's online form, which takes at most ${LIMIT} characters.\n- Private cover: Example Health, membership EX-000000.`,
    'HEALTH CONTEXT:\n- A small cyst behind the left knee was noted on a scan in July 2026 by a vascular consultant, Mr Sample.',
  ],
});

if (!draft) {
  console.log('  FAIL  no draft came back');
  process.exit(1);
}

console.log(`\n  TITLE: ${draft.title}\n`);
console.log(draft.body.split('\n').map((l) => '    ' + l).join('\n'));
console.log('');

const results = [
  [`within the ${LIMIT}-character limit (${draft.body.length})`, draft.body.length <= LIMIT],
  ['mentions the cyst from the record', /cyst/i.test(draft.body)],
  // NOT asserted: the private-cover membership number. The first run left it
  // out and that was right - this request is an ordinary GP referral and never
  // mentions private cover, and the prompt puts reference numbers in only when
  // the message is FOR an insurer or a reception desk. Asking it to appear here
  // would be pinning my guess, not the rule.
  ['leaves a gap rather than inventing when it happened', /\[[^\]]+\]/.test(draft.body) || !/\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(draft.body.replace(/July 2026/g, ''))],
  ['no em dashes', !draft.body.includes('—')],
  ['no exclamation marks', !draft.body.includes('!')],
  ['does not name a diagnosis the record does not hold', !/\b(tear|torn|sprain|tendinitis|tendonitis|meniscus|ligament (?:tear|rupture))\b/i.test(draft.body)],
];
let failed = 0;
for (const [name, okay] of results) {
  console.log(`  ${okay ? 'PASS' : 'FAIL'}  ${name}`);
  if (!okay) failed += 1;
}
console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
