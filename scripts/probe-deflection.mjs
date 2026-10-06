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
const { replyPrompt } = await import(root + '/app/lib/reply-prompt.ts');
const { HEALTH, DEFLECTION_RULE_UNTIL_6_OCTOBER_2026: DEFLECTION } = await import(
  root + '/app/lib/health-support.ts'
);

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

/**
 * SIX MORE, 6 October 2026: "Run the before/after on five or six more messages
 * (a result with numbers, a letter, 'it's probably nothing', a frustrated
 * message), not just the screenshot one."
 *
 * Her four kinds, plus the two that worry me most: somebody apologising for
 * asking, and somebody who has already been dismissed once. Those are the ones
 * her whole brief is about - "they drop out at the moment of doubt."
 */
const CASES = [
  {
    name: 'A result with numbers',
    said: 'My cholesterol came back at 5.8 and the HDL was 1.3. The letter just says "satisfactory, no action needed" but I do not know what that means.',
  },
  {
    name: 'A letter she does not understand',
    said: 'I got a letter saying I am being referred to gynaecology under the 2 week pathway. What does that actually mean and what do I need to do?',
  },
  {
    name: 'Playing it down',
    said: 'It is probably nothing, I do not want to waste anyone time. I have just had this ache in my side for about three weeks.',
  },
  {
    name: 'Frustrated, already dismissed',
    said: 'I went to the GP about the tiredness and she just said it is my age. I am 41. I do not know what to do now.',
  },
  {
    name: 'Apologising for asking',
    said: 'Sorry, this is a silly question and I know you are not a doctor. The hospital asked for my NHS number and I do not know where to find it.',
  },
  {
    name: 'A small practical step',
    said: 'I need to reply to the clinic email to confirm the appointment but I never know what to write.',
  },
];

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

async function ask(system, label, messages = HISTORY) {
  const reply = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages,
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

// THE DIRECTION REVERSED ONCE THE FIX SHIPPED. The composed prompt now carries
// her Health section, so AFTER is what the app runs and BEFORE is reconstructed
// by putting the old sentence back. Keeping the probe runnable afterwards is
// what makes it evidence rather than a thing that was true for an afternoon.
const after = replyPrompt({ voice: false });
const before = after.replace(HEALTH, DEFLECTION);

if (before === after) {
  console.error('  The health block was not found in the composed prompt.');
  process.exit(1);
}

await ask(before, 'BEFORE - the deflection rule as it ships today');
await ask(after, 'AFTER - her Health section in its place');

// THE OTHER SIX, EACH ON ITS OWN, WITH NO HISTORY. A fresh conversation, so the
// reply is to the message rather than to a thread that has already set a tone.
for (const c of CASES) {
  const messages = [{ role: 'user', content: c.said }];
  console.log(`\n\n${'#'.repeat(72)}\n  ${c.name.toUpperCase()}\n  "${c.said}"\n${'#'.repeat(72)}`);
  await ask(before, 'BEFORE', messages);
  await ask(after, 'AFTER', messages);
}
console.log('');
