// Does the allergy gate actually catch things, and does it leave ordinary
// sentences alone?
//
// Item 42 is a safety item, and the repository has no test suite (a known gap in
// Part Four), so this is a probe rather than a test - runnable on demand, proving
// behaviour against the real model rather than a green typecheck.
//
// FALSE NEGATIVES ARE THE DANGER. False positives are the thing that gets a
// safety feature switched off, so both are checked: half these cases exist to
// prove the gate stays quiet when it should.
//
//   node scripts/probe-allergy-gate.mjs

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { deterministicHit, runAllergyGate } from '../app/lib/allergy-gate.ts';

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const A = (...names) => names.map((name) => ({ name, disclosed_at: '2026-01-01' }));

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${got}, wanted ${want})`}`);
};

console.log('\n  LAYER 3 — the deterministic backstop (no API, cannot fail open)\n');
check('peanut named outright', !!deterministicHit('How about peanut butter on toast?', A('peanuts')), true);
check('plural declared, singular used', !!deterministicHit('a peanut sauce', A('peanuts')), true);
check('singular declared, plural used', !!deterministicHit('some peanuts', A('peanut')), true);
check('case and punctuation', !!deterministicHit('Peanut-butter, maybe?', A('peanuts')), true);
// The false positives that would get the gate switched off within a week.
check('"nut" must not fire on "nutrition"', !!deterministicHit('good nutrition matters', A('nut')), false);
check('"egg" must not fire on "eggplant"', !!deterministicHit('roast eggplant', A('egg')), false);
check('unrelated sentence', !!deterministicHit('You logged a walk this morning.', A('peanuts', 'shellfish')), false);

console.log('\n  LAYER 4 — the composite-dish check (real model calls)\n');
const cases = [
  ['pad thai suggested, peanut declared', 'How about pad thai tonight?', A('peanuts'), false],
  ['carbonara suggested, egg declared', 'A carbonara would be quick this evening.', A('egg'), false],
  ['pesto suggested, pine nut declared', 'Try some pesto stirred through pasta.', A('pine nuts'), false],
  ['safe suggestion', 'A chicken salad might suit you tonight.', A('peanuts'), true],
  ['ordinary chat, no food', 'That walk sounds like it did you good.', A('peanuts'), true],
  // The one that matters most for not being annoying: reporting is not suggesting.
  ['reports what they ate, not a suggestion', 'You had pad thai yesterday, that tracks.', A('peanuts'), true],
];

for (const [label, reply, allergies, wantSafe] of cases) {
  const verdict = await runAllergyGate(anthropic, reply, allergies, true);
  check(label, verdict.safe, wantSafe);
}

console.log('\n  SHORT CIRCUIT — costs nothing for somebody with no allergies\n');
const t0 = Date.now();
const none = await runAllergyGate(anthropic, 'How about pad thai tonight?', [], true);
check('no allergies declared, always safe', none.safe, true);
check(`returned without an API call (${Date.now() - t0}ms)`, Date.now() - t0 < 50, true);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
