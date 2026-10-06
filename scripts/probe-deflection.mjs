// THE DEFLECTION RULE, BEFORE AND AFTER, ON HER OWN MESSAGE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-deflection.mjs
//
// Ruth, 6 October 2026: "Test the deflection fix with the exact message from my
// screenshot: 'They don't actually know anything.' Show me the reply before and
// after."
//
// WHAT THIS CHANGES AND WHAT IT DOES NOT. It builds the real reply prompt from
// app/lib/reply-prompt.ts and sends her real message twice: once with the block
// as it ships today, once with that block replaced by her Health section. Only
// that one block differs between the two runs.
//
// WHAT IT IS NOT. It is not the full turn prompt - there is no food log, no
// measurements, no Me tab, no history. Those are built inside the route from her
// account and cannot be assembled here. So this isolates the variable she asked
// about and nothing else, and a reply here is evidence about the RULE rather
// than a prediction of what her phone will say.
//
// IT SPENDS MONEY, two calls. That is the point of it being a probe.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { replyPrompt, REPLY_PROMPT_PARTS } = await import(root + '/app/lib/reply-prompt.ts');
const { HEALTH } = await import(root + '/app/lib/health-support.ts').catch(() => ({ HEALTH: null }));

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
const MODEL = 'claude-sonnet-5';

/** Her screenshot, 5 October, 20:39. The turn before it, then the turn itself. */
const HISTORY = [
  {
    role: 'user',
    content:
      "Looking at last week, it seems pretty steady eating intuitively. But im wondering how my saturated fat intake is compared to what it should be given my high cholesterol was flagged at my 40yr NHS check up. Only slightly but still",
  },
  {
    role: 'assistant',
    content:
      "That's not something tracked here - the log has calories and protein, but not a saturated fat breakdown, so there's no figure to compare against anything for you.\n\nThe cholesterol flag itself is worth taking to your GP or a practice nurse - they can tell you what level of change actually matters for your numbers, which is more useful than guessing at it from a food log that isn't built to measure it.",
  },
  { role: 'user', content: "They don't actually know anything." },
];

async function ask(system, label) {
  const reply = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: HISTORY,
  });
  const text = reply.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  console.log(`\n${'='.repeat(72)}\n  ${label}\n${'='.repeat(72)}\n`);
  console.log(text);
  return text;
}

const before = replyPrompt({ voice: false });

if (!HEALTH) {
  console.log('\n  app/lib/health-support.ts does not exist yet, so only BEFORE can run.\n');
  await ask(before, 'BEFORE - the deflection rule as it ships today');
  process.exit(0);
}

// ONE BLOCK SWAPPED, NOTHING ELSE. String replacement on the composed prompt, so
// the two runs are identical apart from the rule under test.
const after = before.replace(REPLY_PROMPT_PARTS.NOT_A_DOCTOR, HEALTH);
if (after === before) {
  console.error('  The deflection block was not found in the composed prompt.');
  process.exit(1);
}

await ask(before, 'BEFORE - the deflection rule as it ships today');
await ask(after, 'AFTER - her Health section in its place');
console.log('');
