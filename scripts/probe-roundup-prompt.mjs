// THE REBUILT ROUNDUP, ON HER REAL WEEK.
//
// Ruth, item 6: "rebuild the roundup prompt the same way as the chat prompt, then
// test it on my real week (21-27 Sept), not the demo account."
//
// So the numbers below are hers, read out of the database on 28 September: every
// food log, the single two-minute activity, steps for all seven days, sixteen
// drinks and the weight readings. Nothing is invented and nothing is rounded to
// make a point.
//
// WHAT THE OLD PROMPT SAID ABOUT A WEEK LIKE THIS: "almost no movement to speak
// of", "your 10 readings show a real trend downward", and "the thread running
// through this week is permission: you've been letting yourself off the hook in
// small ways". The checks below are that week's failures turned into questions.
//
//   node --import ./scripts/ts-paths.mjs scripts/probe-roundup-prompt.mjs

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { roundupPrompt } from '../app/lib/roundup-prompt.ts';
import { roundupFigures } from '../app/lib/roundup-figures.ts';
import { EVIDENCE_PRINCIPLE } from '../app/lib/principles.ts';

const ROOT = 'C:/Users/ruthi/unflump-app';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Her week, 21-27 September 2026.
const STEPS = [2262, 8361, 4467, 7877, 9820, 7242, 8391];
const DRINK_DAYS = [1250, 1668, 1668, 1568]; // 21st, 23rd, 25th, 26th

const FIGURES = roundupFigures({
  fullDays: 7,
  avgKcal: { value: 1236, confidence: null },
  avgProtein: { value: 62, confidence: null },
  // THE THREE DISTINCT READINGS, not the eight rows. See the note at the bottom:
  // six of her rows are a duplicate cluster written within 28 seconds on the 24th.
  delta: {
    first: { value: 55.6, date: '2026-09-22' },
    last: { value: 56.9, date: '2026-09-27' },
    change: 1.3,
    readingCount: 3,
  },
  readingCount: 3,
  activity: [{ activity_type: 'pushups', duration_min: 2, intensity: 'moderate' }],
  drinkDayTotals: DRINK_DAYS,
  stepDays: STEPS,
});

console.log('\n## The card she would see\n');
for (const f of FIGURES) {
  console.log(`  ${f.label.padEnd(11)} ${f.value}${f.note ? `\n              (${f.note})` : ''}`);
}

const WEEK_TEXT = `WEEK OF 21 TO 27 SEPTEMBER 2026.

THE CARD ABOVE YOUR WORDS ALREADY SHOWS THESE, so do not list them again:
${FIGURES.map((f) => `  ${f.label}: ${f.value}${f.note ? ` (${f.note})` : ''}`).join('\n')}

TRAJECTORY: three readings is few. You may say the direction is upward across the week and must say how few readings that rests on.

MOVEMENT THIS WEEK:
24 Sept: pushups, 2 min, moderate

STEPS THIS WEEK: recorded on 7 of 7 days, from 2,262 to 9,820, averaging 6,917 a day. A DAY WITH STEPS AND NO SESSION IS NOT A DAY WITHOUT MOVEMENT, and must never be described as one.

WHAT SHE AGREED TO KEEP THIS WEEK (already in her Almanac):
(nothing kept this week)

WHAT SHE SAID THIS WEEK, in her own words:
2026-09-26: Its nice to eat whatever I want, but I do feel less lean, so it's not sustainable
2026-09-26: It's just extra fat. I had less of the feeling before pregnancy
2026-09-26: Neither. It's not terrible and taking a break from a deficit is fine, good even. I'm a healthy weight.

STANDING CONTEXT:
(none)

EARLIER ROUNDUPS IN THE LAST 6 WEEKS:
(no earlier roundups - this is the first)`;

const system = roundupPrompt({
  portraitRange: 'the last 6 weeks',
  evidencePrinciple: EVIDENCE_PRINCIPLE,
});

const res = await anthropic.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1500,
  system,
  messages: [{ role: 'user', content: WEEK_TEXT }],
  tools: [
    {
      name: 'weekly_roundup',
      description: "The week's roundup, in your voice, and the witness statements for her Almanac.",
      input_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          statements: { type: 'array', items: { type: 'string' } },
        },
        required: ['reply', 'statements'],
      },
    },
  ],
  tool_choice: { type: 'tool', name: 'weekly_roundup' },
});

const block = res.content.find((b) => b.type === 'tool_use');
const reply = (block?.input?.reply ?? '').trim();
const statements = block?.input?.statements ?? [];

console.log('\n## What it writes underneath\n');
console.log('> ' + reply.split('\n').join('\n> '));
console.log('\n## Witness statements\n');
for (const st of statements) console.log(`  - ${st}`);

const CHECKS = [
  // THE THEME, which is the whole point of item 6. The old prompt asked for one
  // by name and got "the thread running through this week is permission".
  ['no thread through the week', !/thread running|the thread|running through/i.test(reply)],
  ['no theme named as one', !/\btheme\b|what this week was about/i.test(reply)],
  ['no verdict on her character', !/letting yourself|permission|you've been|avoiding|discipline/i.test(reply)],
  ['nothing to "sit with"', !/sit with|worth sitting/i.test(reply)],

  // The wrong figures from her real roundup.
  ['does not call it no movement', !/almost no movement|no movement|barely moved|little movement/i.test(reply)],
  ['does not overstate the readings', !/\b(8|eight|10|ten) readings/i.test(reply)],
  ['says how few readings there are', /three readings|3 readings|only three|few readings/i.test(reply)],
  ['does not call three a real trend', !/real trend|clear trend|definite trend/i.test(reply)],

  // Not restating the card.
  ['does not restate the calorie average', !/1,?236 kcal/i.test(reply)],
  ['does not restate the step average', !/6,?917/i.test(reply)],

  // It has to actually say something.
  ['says something', reply.length > 40],
  ['picks up her own words', /lean|deficit|healthy weight|break/i.test(reply)],
  ['ends on a question', /\?\s*$/.test(reply)],
  ['no moralising about food', !/\b(bad|cheat|guilty|junk|clean|treat yourself)\b/i.test(reply)],
  ['written to her, not about her', !/\bshe (logged|said|asked|had)\b/i.test(reply)],
];

console.log('');
let failed = 0;
for (const [name, ok] of CHECKS) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

console.log(failed === 0 ? '\n  all checks passed\n' : `\n  ${failed} check(s) failed\n`);
console.log('  NOTE, and it needs Ruth: six of her eight weight rows for this week are a');
console.log('  duplicate cluster written within 28 seconds on 24 Sept (58, 58, 55.5, 55.5,');
console.log('  55.5, 55.5). This probe counts the three distinct readings. Her real roundup');
console.log('  would count eight, which is exactly the "10 readings" failure again.\n');
process.exit(failed === 0 ? 0 : 1);
