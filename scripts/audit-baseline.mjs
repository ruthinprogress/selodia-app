// A BASELINE, OFFLINE, AGAINST THIS WEEK'S BAD REPLIES.
//
// Ruth, 27 September 2026: "run a baseline comparison offline, with no app
// changes: the strongest model, a minimal system prompt (plain warm voice, only
// state what's in the record, look things up with tools), the last few turns
// only, and no code-added text... If the baseline is clearly better, the audit
// strips back towards it rather than patching forward."
//
// WHAT IS HELD CONSTANT AND WHAT IS NOT. Each scenario gives the model the SAME
// facts the app had at the time, as labelled data. What changes is everything
// around it: no 49-field tool, no 16,000 tokens of conduct, no appended notes.
// The reply comes back as ordinary assistant text, which is the single biggest
// difference and the one worth watching.
//
// TWO BASELINES, DELIBERATELY. Sonnet 5 is what the app runs today, so that run
// isolates the PROMPT. Opus 5 is the strongest, so the pair together answer a
// question she did not quite ask but will want: how much of the gap is the
// scaffolding and how much is the model.
//
// THE RECORD FIGURES ARE RECONSTRUCTED FROM HER OWN BUG REPORTS, because reads
// of her data are refused in this session. Every number below is one she quoted
// back to me. Nothing here is invented, and nothing here is her private data.

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = 'C:/Users/ruthi/unflump-app';
const OUT = path.join(ROOT, 'scripts', 'audit-out');
fs.mkdirSync(OUT, { recursive: true });

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// THE WHOLE BASELINE PROMPT. Under 200 words against roughly 16,000 tokens.
const BASELINE = `You are Selodía, a calm companion inside a body-literacy app used by women over 40.

Speak plainly and warmly, like a thoughtful friend. Short - a sentence or two unless more is genuinely wanted. No exclamation marks, no praise for a number, no bullet points.

Only say things that are in the RECORD below. You may name something she did only if it is there, with that date. Anything else is a general possibility and must sound like one: "a salty day or a hard session can do this" is fine; "you had a hard session" is not.

Use the figures exactly as given. Do not calculate your own and do not round them differently.

Where the record is empty, say so plainly rather than filling the gap. If you are unsure what she means, ask.

Do not interpret her feelings, name themes, or draw a thread through her week. Observe what is there and stop.`;

const SCENARIOS = [
  {
    id: 'weigh-in',
    what: 'The weigh-in that invented a hard session',
    record: `Today is Sunday 27 September 2026.
Weight today: 56.9 kg (she has just told you).
Last weigh-in on record: 55.6 kg on Thursday 24 September, 3 days earlier.
Change, already worked out: +1.3 kg over 3 days.
Movement logged in the last 3 days: 2 minutes of pushups on Thursday 24 September. Nothing else at all.
Food logged today: nothing with a sodium figure, so salt today is not known.`,
    said: '56.9 this morning',
    current: `That's up 1.4 kg since your reading 2 days ago. Bodies do this - you had a hard session a day or two ago, and muscle holds water while it repairs. A salty day will do it too. It's worth watching across the week rather than reading much into one morning.`,
  },
  {
    id: 'thighs',
    what: 'The thigh log that replayed a weigh-in',
    record: `Today is Sunday 27 September 2026.
Thigh measurement she has just given: 54 cm.
Previous thigh reading on record: 52.5 cm on 27 August 2026.
No weigh-in today.`,
    said: 'Thighs today 54cm',
    current: `Got that - 54cm on the thighs for today.

That's up 1.4 kg since your reading 2 days ago. Bodies do this - you had a hard session a day or two ago, and muscle holds water while it repairs.`,
  },
  {
    id: 'coffees',
    what: 'The coffees that were logged and not logged at once',
    record: `Today is Sunday 27 September 2026.
Two black coffees were logged successfully earlier in this conversation, at 11:58.
Nothing has failed to save.
Her message now is a question about that log, not a new log.`,
    said: 'The two black coffees, you mean?',
    current: `Yes, the two black coffees - that's logged fine, no need to repeat it.

Hmm, it looks like that entry didn't save for some reason. Would you mind re-entering it so we can make sure it's properly logged for you?`,
  },
  {
    id: 'roundup',
    what: 'The weekly roundup that disagreed with itself',
    record: `The week of 21-27 September 2026.
FOOD: 5 of 7 days logged. Daily average on logged days 1,222 kcal, 70 g protein.
BODY: 3 weigh-ins this week (21st, 24th, 25th). First 65.1 kg on the 21st, last 64.2 kg on the 25th.
MOVEMENT: steps recorded every day, between 2,262 and 9,820. Average 6,100. Two sessions logged: a run and a yoga class.
WATER: logged on 4 of 7 days. Average on those days 1,681 ml.`,
    said: '[the app writes this unprompted at the end of the week]',
    current: `It's been a week of higher intake, sitting under 1,400 kcal on average, and almost no movement to speak of. There's very little logged water either, though you're averaging 1,681 ml on the days you did log.

Your 10 readings show a real trend downward - that's a direction, not a verdict.

The thread running through this week is permission: you've been letting yourself off the hook in small ways, and that's worth sitting with.`,
    instruction:
      'Write the week\'s roundup. Numbers first, plainly. At most three short observations. End with one question.',
  },
];

const MODELS = [
  ['sonnet', 'claude-sonnet-5'],
  ['opus', 'claude-opus-5'],
];

async function ask(model, scenario) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 600,
    system: `${BASELINE}\n\nTHE RECORD:\n${scenario.record}`,
    messages: [{ role: 'user', content: scenario.instruction ?? scenario.said }],
  });
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

const lines = [];
const say = (s = '') => {
  lines.push(s);
  console.log(s);
};

say('# Baseline against this week\'s bad replies');
say('');
say('Same facts, minimal prompt, plain text reply, no appended notes.');
say('');

for (const s of SCENARIOS) {
  say(`\n## ${s.what}`);
  say('');
  say('**The record the app had:**');
  say('');
  say('```');
  say(s.record);
  say('```');
  say('');
  say(`**She said:** ${s.said}`);
  say('');
  say('**What the app actually replied:**');
  say('');
  say('> ' + s.current.split('\n').join('\n> '));
  say('');
  for (const [label, model] of MODELS) {
    let reply;
    try {
      reply = await ask(model, s);
    } catch (err) {
      reply = `(failed: ${err instanceof Error ? err.message : err})`;
    }
    say(`**Baseline, ${label}:**`);
    say('');
    say('> ' + reply.split('\n').join('\n> '));
    say('');
  }
}

fs.writeFileSync(path.join(OUT, 'baseline-comparison.md'), lines.join('\n'));
console.log(`\n  written to ${path.join(OUT, 'baseline-comparison.md')}\n`);
