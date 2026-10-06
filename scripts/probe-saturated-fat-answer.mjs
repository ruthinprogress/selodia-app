// BEFORE AND AFTER ON THE REPLY SHE CALLED A FLOP.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-saturated-fat-answer.mjs
//
// Ruth, 6 October 2026, 21:32. She asked "How much saturated fat have I had this
// week", got six real daily figures at last, and then this:
//
//   "There's no target set for it here, so I can't tell you whether that sits on
//   the safe side for your check-up result - that's one for your GP to weigh in
//   on alongside the blood result itself."
//
// "Interpretation layer flopped."
//
// HER OWN NUMBERS, FROM THE SCREENSHOT. Six days, 13g to 40g, so the before run
// reproduces the reply she actually got rather than an invented one.
//
// THREE RUNS, because the question is whether the shape of the reply changed and
// a single sample cannot tell you that. A pass here is evidence, not a guarantee.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { replyPrompt } = await import(root + '/app/lib/reply-prompt.ts');
const { turnFacts } = await import(root + '/app/lib/turn-facts.ts');
const { MACRO_COLUMN } = await import(root + '/app/lib/tracked-macro-summary.ts');
const { buildHealthContextPrompt } = await import(root + '/app/lib/health-context.ts');

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

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Her six days off the screenshot, one meal a day carrying the whole total.
const DAYS = [
  ['2026-10-05T18:00:00Z', 17, 'chicken and rice'],
  ['2026-10-04T18:00:00Z', 25, 'roast dinner'],
  ['2026-10-03T18:00:00Z', 27, 'pizza'],
  ['2026-10-02T18:00:00Z', 25, 'pasta and cheese'],
  ['2026-10-01T18:00:00Z', 40, 'four eggs, bacon, toast'],
  ['2026-09-30T18:00:00Z', 13, 'soup and bread'],
];

const food = DAYS.map(([at, sat, text]) => ({
  happened_at: at,
  raw_text: text,
  kcal: 700,
  protein_g: 35,
  saturated_fat_g: sat,
}));

const base = {
  food,
  activity: [],
  dailyBurn: [],
  drinks: [],
  sleep: [],
  measurements: [],
  lastPeriodStart: null,
  days: 7,
};

const macro = (withGuideline) => [
  {
    key: 'saturated',
    column: 'saturated_fat_g',
    label: 'saturated fat',
    unit: 'g',
    guideline: withGuideline ? MACRO_COLUMN.saturated.guideline : null,
  },
];

// THE STORED FLAG, which is the other half. Until tonight nothing could keep it,
// so the elevated-LDL rule had never once reached the model that answers.
const HC = {
  ldl_status: 'elevated',
  hdl_status: null,
  cholesterol_status: null,
  glucose_status: null,
  ferritin_status: null,
  thyroid_status: null,
  condition_pcos: false,
  condition_ibs: false,
  condition_hypothyroid: false,
  condition_t2d: false,
  conditions_other: null,
};

const SAID = 'How much saturated fat have I had this week';

async function run(label, { guideline, marker }) {
  const parts = [
    `TODAY: Monday 6 October 2026.`,
    `THE RECORD:\n${turnFacts({ ...base, trackedMacros: macro(guideline) })}`,
  ];
  if (marker) parts.push(buildHealthContextPrompt(HC));
  parts.push(`THEY SAID: ${SAID}`);

  const reply = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 800,
    system: replyPrompt({ voice: false }),
    messages: [{ role: 'user', content: parts.join('\n\n') }],
  });
  const text = reply.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  console.log(`${'='.repeat(72)}\n  ${label}\n${'='.repeat(72)}\n`);
  console.log(text);
  console.log('');

  return {
    deflects: /ask your GP|for your GP|one for your GP|GP to weigh/i.test(text),
    saysFigure: /20\s*g|20 grams/i.test(text),
    saysTarget: /your target/i.test(text),
    verdict: /\b(safe|unsafe|fine|too high|dangerous)\b/i.test(text),
  };
}

console.log(`\n  "${SAID}"\n  Her six days: 17, 25, 27, 25, 40, 13.\n`);

const scores = { before: [], after: [] };
for (let i = 1; i <= 3; i += 1) {
  scores.before.push(await run(`BEFORE  run ${i}  (no guideline, no stored flag)`, { guideline: false, marker: false }));
  scores.after.push(await run(`AFTER  run ${i}  (guideline carried, cholesterol flag stored)`, { guideline: true, marker: true }));
}

const tally = (rs, k) => rs.filter((r) => r[k]).length;
console.log(`${'='.repeat(72)}\n  TALLY over 3 runs each\n${'='.repeat(72)}\n`);
console.log(`  hands her to her GP       before ${tally(scores.before, 'deflects')}/3   after ${tally(scores.after, 'deflects')}/3`);
console.log(`  states the 20g figure     before ${tally(scores.before, 'saysFigure')}/3   after ${tally(scores.after, 'saysFigure')}/3`);
console.log(`  calls it HER target       before ${tally(scores.before, 'saysTarget')}/3   after ${tally(scores.after, 'saysTarget')}/3   (want 0)`);
console.log(`  gives a safe/unsafe verdict  before ${tally(scores.before, 'verdict')}/3   after ${tally(scores.after, 'verdict')}/3   (want 0)`);
console.log('');
