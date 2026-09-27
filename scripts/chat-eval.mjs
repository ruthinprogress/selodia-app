// THE TEST SET FOR THE CHAT, AND THE BEFORE-AND-AFTER ON IT.
//
// Ruth, 27 September 2026: "Keep this week's bad conversations as the test set,
// and add a few good ones, so we know nothing that worked gets worse. Show me
// before and after on the full set before it ships."
//
// WHAT "BEFORE" MEANS HERE, stated plainly because it is not the obvious thing.
// For the four failures it is her own transcript, quoted from her bug reports -
// the real replies the app gave. For the good cases there is no transcript to
// quote, because reads of her chat are refused in this session, so "before" is
// the CURRENT PROMPT run offline on the same facts. That is a fair comparison
// for the question those cases exist to answer - does anything that worked get
// worse - and it is not the same evidence as a real transcript. Marked as such
// on each case rather than blurred.
//
// WHAT IS ACTUALLY BEING COMPARED. Same facts, same model, two prompts:
//   BEFORE  the reply as a FIELD in the 49-field classify tool, with ~16,000
//           tokens of instruction in front of it
//   AFTER   the reply as plain assistant text, with the rebuilt prompt and
//           computed, rounded, labelled facts
//
// Run:  node scripts/chat-eval.mjs
//       node scripts/chat-eval.mjs --only roundup

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { replyPrompt } from '../app/lib/reply-prompt.ts';
import { turnFacts } from '../app/lib/turn-facts.ts';

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
const MODEL = 'claude-sonnet-5';

// The old conduct block, read from the route so this compares against what is
// actually deployed rather than against a copy that can drift.
function currentConduct() {
  const src = fs.readFileSync(path.join(ROOT, 'app/api/ask-selodia/route.ts'), 'utf8');
  const m = /const GENERAL_CONDUCT = `/.exec(src);
  if (!m) return '(GENERAL_CONDUCT not found)';
  let j = m.index + m[0].length;
  const out = [];
  while (j < src.length) {
    if (src[j] === '\\') {
      out.push(src.slice(j, j + 2));
      j += 2;
    } else if (src[j] === '`') break;
    else out.push(src[j++]);
  }
  return out.join('');
}

const CONDUCT = currentConduct();

// A stand-in for the classify tool: the reply as one field among many, which is
// the shape that matters, without reproducing all 49.
const CLASSIFY_TOOL = {
  name: 'classify_and_reply',
  description: 'Classify the message and write the reply.',
  input_schema: {
    type: 'object',
    properties: {
      classification: { type: 'string', enum: ['neutral', 'ambiguous', 'distress'] },
      logIntent: { type: 'string', enum: ['none', 'food', 'activity', 'measurement', 'hydration', 'sleep'] },
      logText: { type: 'string' },
      correctionKind: { type: 'string' },
      proposedSave: { type: 'object' },
      reply: { type: 'string', description: 'What to say to the person.' },
    },
    required: ['classification', 'reply'],
  },
};

// ── THE SET ──────────────────────────────────────────────────────────────────
//
// `data` is fed through turn-facts so the AFTER column gets computed, rounded,
// labelled facts. `prose` is the same information the old prompt would have
// had, as sentences, which is what the BEFORE column gets.

const TODAY = new Date('2026-09-27T09:00:00Z');

const CASES = [
  {
    id: 'weigh-in',
    kind: 'bad',
    what: 'The weigh-in that invented a hard session',
    said: '56.9 this morning',
    transcript: `That's up 1.4 kg since your reading 2 days ago. Bodies do this - you had a hard session a day or two ago, and muscle holds water while it repairs. A salty day will do it too.`,
    prose: `Here are their body measurements from the last 7 days:\n24 Sept: weight 55.58kg, body fat 27.9%\n\nHere is their activity log from the last 7 days:\n24 Sept: pushups (2 min, light)`,
    data: {
      days: 7,
      food: [],
      activity: [{ happened_at: '2026-09-24T18:00:00Z', activity_type: 'pushups', duration_min: 2, kcal_burned: 7, intensity: 'light' }],
      dailyBurn: [],
      drinks: [],
      sleep: [],
      measurements: [{ measured_at: '2026-09-24T08:16:00Z', weight_kg: 55.58, body_fat_pct: 27.9 }],
      lastPeriodStart: '2026-09-21',
    },
    extra: 'She has just told you she weighed 56.9 kg this morning. Rounded as the screen rounds it, that is 56.9 kg against 55.6 kg on Thu 24 Sept: +1.3 kg across 3 days.',
    checks: [
      ['does not invent a session', (r) => !/hard session|heavy session|training session|workout you/i.test(r)],
      ['uses 1.3, not 1.4', (r) => !/1\.4/.test(r)],
      ['does not say two days', (r) => !/2 days ago|two days ago/i.test(r)],
    ],
  },
  {
    id: 'thighs',
    kind: 'bad',
    what: 'The thigh log that replayed a weigh-in',
    said: 'Thighs today 54cm',
    transcript: `Got that - 54cm on the thighs for today.\n\nThat's up 1.4 kg since your reading 2 days ago. Bodies do this - you had a hard session a day or two ago.`,
    prose: `Here are their body measurements from the last 7 days:\n24 Sept: weight 55.58kg, body fat 27.9%`,
    data: {
      days: 7, food: [], activity: [], dailyBurn: [], drinks: [], sleep: [],
      measurements: [{ measured_at: '2026-09-24T08:16:00Z', weight_kg: 55.58, body_fat_pct: 27.9 }],
      lastPeriodStart: '2026-09-21',
    },
    extra: 'She has just given a thigh measurement of 54 cm. Her previous thigh reading is 52.5 cm on 27 August 2026. It saved. There is no weigh-in today.',
    checks: [
      ['is about thighs', (r) => /thigh|52\.5|54/i.test(r)],
      ['does not mention weight in kg', (r) => !/\bkg\b/i.test(r)],
      ['does not invent a session', (r) => !/hard session|heavy session/i.test(r)],
    ],
  },
  {
    id: 'coffees',
    kind: 'bad',
    what: 'The coffees that were logged and not logged at once',
    said: 'The two black coffees, you mean?',
    transcript: `Yes, the two black coffees - that's logged fine, no need to repeat it.\n\nHmm, it looks like that entry didn't save for some reason. Would you mind re-entering it so we can make sure it's properly logged for you?`,
    prose: `Here is their food log from the last 7 days:\n27 Sept: two black coffees (0kcal, 0g protein)`,
    data: {
      days: 7,
      food: [{ happened_at: '2026-09-27T11:58:00Z', raw_text: 'two black coffees', kcal: 0, protein_g: 0 }],
      activity: [], dailyBurn: [], drinks: [], sleep: [], measurements: [], lastPeriodStart: null,
    },
    extra: 'Two black coffees were logged successfully at 11:58 today. Nothing has failed to save. Her message is a question about that log, not a new log.',
    checks: [
      ['does not claim a failure', (r) => !/didn.t save|did not save|re-enter|re-entering/i.test(r)],
      ['confirms it is there', (r) => /logged|saved|it.s there|11:58/i.test(r)],
      ['does not contradict itself', (r) => !(/logged fine/i.test(r) && /didn.t save/i.test(r))],
    ],
  },
  {
    id: 'roundup',
    kind: 'bad',
    what: 'The weekly roundup that disagreed with itself',
    said: '[written unprompted at the end of the week]',
    roundup: true,
    transcript: `It's been a week of higher intake, sitting under 1,400 kcal on average, and almost no movement to speak of. There's very little logged water either, though you're averaging 1,681 ml on the days you did log.\n\nYour 10 readings show a real trend downward - that's a direction, not a verdict.\n\nThe thread running through this week is permission: you've been letting yourself off the hook in small ways, and that's worth sitting with.`,
    prose: `Food log: 5 days with entries averaging about 1222 kcal. Measurements: 65.1kg on 21 Sept, 64.4kg on 24 Sept, 64.2kg on 25 Sept. Steps: 2262 to 9820 across the week. Water logged on 4 days.`,
    data: {
      days: 7,
      food: [
        { happened_at: '2026-09-21T12:00:00Z', raw_text: 'porridge, chicken salad, pasta', kcal: 1260, protein_g: 61 },
        { happened_at: '2026-09-22T12:00:00Z', raw_text: 'eggs, soup, curry', kcal: 1340, protein_g: 103 },
        { happened_at: '2026-09-23T12:00:00Z', raw_text: 'toast, sandwich, risotto', kcal: 1350, protein_g: 58 },
        { happened_at: '2026-09-24T12:00:00Z', raw_text: 'yoghurt, wrap, stir fry', kcal: 1340, protein_g: 80 },
        { happened_at: '2026-09-25T12:00:00Z', raw_text: 'toast, leftovers', kcal: 820, protein_g: 49 },
      ],
      activity: [
        { happened_at: '2026-09-25T09:00:00Z', activity_type: 'run', duration_min: 32, kcal_burned: 280, intensity: 'moderate' },
        { happened_at: '2026-09-23T18:00:00Z', activity_type: 'yoga', duration_min: 45, kcal_burned: 120, intensity: 'light' },
      ],
      dailyBurn: [
        { date: '2026-09-21', steps: 7610, kcal_burned: null, active_minutes: null },
        { date: '2026-09-22', steps: 9940, kcal_burned: null, active_minutes: null },
        { date: '2026-09-23', steps: 6890, kcal_burned: null, active_minutes: null },
        { date: '2026-09-24', steps: 2262, kcal_burned: null, active_minutes: null },
        { date: '2026-09-25', steps: 8420, kcal_burned: null, active_minutes: null },
        { date: '2026-09-26', steps: 9820, kcal_burned: null, active_minutes: null },
        { date: '2026-09-27', steps: 3863, kcal_burned: null, active_minutes: null },
      ],
      drinks: [
        { happened_at: '2026-09-22T10:00:00Z', ml: 1800 },
        { happened_at: '2026-09-23T10:00:00Z', ml: 1500 },
        { happened_at: '2026-09-25T10:00:00Z', ml: 1900 },
        { happened_at: '2026-09-26T10:00:00Z', ml: 1525 },
      ],
      sleep: [],
      measurements: [
        { measured_at: '2026-09-21T08:00:00Z', weight_kg: 65.1, body_fat_pct: 28.3 },
        { measured_at: '2026-09-24T08:16:00Z', weight_kg: 64.44, body_fat_pct: 28.0 },
        { measured_at: '2026-09-25T08:00:00Z', weight_kg: 64.2, body_fat_pct: 27.8 },
      ],
      lastPeriodStart: '2026-09-21',
    },
    extra: 'Write the week of 21-27 September.',
    checks: [
      ['does not call it no movement', (r) => !/almost no movement|no movement|little movement|barely moved/i.test(r)],
      ['does not call 1,222 high', (r) => !/higher intake|high intake|eating more/i.test(r)],
      ['does not say ten readings', (r) => !/10 readings|ten readings/i.test(r)],
      ['does not call three a real trend', (r) => !/real trend|clear trend|definite trend/i.test(r)],
      ['no psychological theme', (r) => !/thread running|theme|permission|letting yourself|sit with/i.test(r)],
    ],
  },

  // ── GOOD CASES. Nothing that works should get worse. ───────────────────────
  {
    id: 'good-food-log',
    kind: 'good',
    what: 'An ordinary food log',
    said: 'Had porridge with blueberries and a coffee with oat milk',
    transcript: null,
    prose: `Here is their food log from the last 7 days:\n26 Sept: chicken salad (520kcal, 41g protein)`,
    data: {
      days: 7,
      food: [{ happened_at: '2026-09-26T13:00:00Z', raw_text: 'chicken salad', kcal: 520, protein_g: 41 }],
      activity: [], dailyBurn: [], drinks: [], sleep: [], measurements: [], lastPeriodStart: null,
    },
    extra: 'It saved: porridge with blueberries and a coffee with oat milk, 410 kcal, 12 g protein. The app shows her its own save confirmation, so do not list the items back or say it is logged.',
    checks: [
      ['warm and short', (r) => r.length < 420],
      ['does not list a receipt', (r) => !/410 kcal.*12 g protein|logged:/i.test(r)],
      ['no exclamation mark', (r) => !/!/.test(r)],
    ],
  },
  {
    id: 'good-hard-day',
    kind: 'good',
    what: 'A hard day, said in passing',
    said: "Didn't manage much today, felt rough and just had toast",
    transcript: null,
    prose: `Here is their food log from the last 7 days:\n27 Sept: toast (180kcal, 6g protein)`,
    data: {
      days: 7,
      food: [{ happened_at: '2026-09-27T19:00:00Z', raw_text: 'toast', kcal: 180, protein_g: 6 }],
      activity: [], dailyBurn: [{ date: '2026-09-27', steps: 1120, kcal_burned: null, active_minutes: null }],
      drinks: [], sleep: [], measurements: [], lastPeriodStart: null,
    },
    extra: 'The toast saved.',
    checks: [
      ['does not congratulate or scold', (r) => !/well done|good job|should|try to|make sure you/i.test(r)],
      ['picks up what she said', (r) => /rough|hard|tough|sounds/i.test(r)],
      ['short', (r) => r.length < 420],
    ],
  },
  {
    id: 'good-question',
    kind: 'good',
    what: 'A real question about her own data',
    said: "What's my protein been like this week?",
    transcript: null,
    prose: `Here is their food log from the last 7 days:\n21 Sept: 61g protein\n22 Sept: 103g protein\n23 Sept: 58g protein\n24 Sept: 80g protein\n25 Sept: 49g protein`,
    data: {
      days: 7,
      food: [
        { happened_at: '2026-09-21T12:00:00Z', raw_text: 'porridge, chicken salad, pasta', kcal: 1260, protein_g: 61 },
        { happened_at: '2026-09-22T12:00:00Z', raw_text: 'eggs, soup, curry', kcal: 1340, protein_g: 103 },
        { happened_at: '2026-09-23T12:00:00Z', raw_text: 'toast, sandwich, risotto', kcal: 1350, protein_g: 58 },
        { happened_at: '2026-09-24T12:00:00Z', raw_text: 'yoghurt, wrap, stir fry', kcal: 1340, protein_g: 80 },
        { happened_at: '2026-09-25T12:00:00Z', raw_text: 'toast, leftovers', kcal: 820, protein_g: 49 },
      ],
      activity: [], dailyBurn: [], drinks: [], sleep: [], measurements: [], lastPeriodStart: null,
    },
    extra: '',
    checks: [
      ['gives the average', (r) => /70|seventy/.test(r)],
      ['says it is 5 of 7 days', (r) => /5 of 7|five of seven|five days|5 days/i.test(r)],
      ['does not invent a target', (r) => !/should be aiming|target of|you need/i.test(r)],
    ],
  },
  {
    id: 'good-save-failed',
    kind: 'good',
    what: 'A save that genuinely failed',
    said: 'Waist 78cm this morning',
    transcript: null,
    prose: `Here are their body measurements from the last 7 days:\n25 Sept: weight 64.2kg`,
    data: {
      days: 7, food: [], activity: [], dailyBurn: [], drinks: [], sleep: [],
      measurements: [{ measured_at: '2026-09-25T08:00:00Z', weight_kg: 64.2, body_fat_pct: 27.8 }],
      lastPeriodStart: null,
    },
    extra: 'THE WAIST MEASUREMENT DID NOT SAVE. The app tried twice with her own words and both attempts failed. Nothing of it is in her log.',
    checks: [
      ['says it did not save', (r) => /(didn.t|did not|hasn.t|has not|not)\s+(\w+\s+)?saved?/i.test(r)],
      ['does not claim it saved', (r) => !/logged it|got that down|saved it/i.test(r)],
      ['does not ask her to retype', (r) => !/re-enter|type it again|say it again|repeat it/i.test(r)],
      ['does not recite the untouched record', (r) => !/(everything else|no food, movement|nothing else) /i.test(r)],
    ],
  },
];

// ── RUNNERS ──────────────────────────────────────────────────────────────────

async function before(c) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: CONDUCT + '\n\n' + c.prose + (c.extra ? `\n\n${c.extra}` : ''),
    messages: [{ role: 'user', content: c.said }],
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: 'tool', name: CLASSIFY_TOOL.name },
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  return (block?.input?.reply ?? '(no reply field)').trim();
}

async function after(c) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: `${replyPrompt({ roundup: c.roundup })}\n\nTHE RECORD:\n${turnFacts(c.data, TODAY)}${c.extra ? `\n\n${c.extra}` : ''}`,
    messages: [{ role: 'user', content: c.said }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

function score(c, reply) {
  return c.checks.map(([name, test]) => [name, test(reply)]);
}

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const set = only ? CASES.filter((c) => c.id === only) : CASES;

const md = [];
const say = (s = '') => {
  md.push(s);
  console.log(s);
};

say('# The chat test set: before and after');
say('');
say('Same facts, same model (Sonnet 5), two prompts. BEFORE is the reply as a field in the classify tool with the current conduct block. AFTER is plain text with the rebuilt prompt and computed facts.');
say('');

let beforePassed = 0;
let afterPassed = 0;
let totalChecks = 0;

for (const c of set) {
  say(`\n## ${c.what}  \`${c.id}\`  (${c.kind})`);
  say('');
  say(`**She said:** ${c.said}`);
  say('');

  if (c.transcript) {
    say('**What the app really replied, from her report:**');
    say('');
    say('> ' + c.transcript.split('\n').join('\n> '));
    say('');
  }

  let b = '(not run)';
  let a = '(not run)';
  try { b = await before(c); } catch (e) { b = `(failed: ${e.message})`; }
  try { a = await after(c); } catch (e) { a = `(failed: ${e.message})`; }

  const bs = score(c, b);
  const as = score(c, a);
  beforePassed += bs.filter(([, ok]) => ok).length;
  afterPassed += as.filter(([, ok]) => ok).length;
  totalChecks += c.checks.length;

  say(`**BEFORE** — current prompt, reply inside the tool${c.transcript ? ' (re-run offline)' : ''}:`);
  say('');
  say('> ' + b.split('\n').join('\n> '));
  say('');
  say(bs.map(([n, ok]) => `  ${ok ? 'PASS' : 'FAIL'}  ${n}`).join('\n'));
  say('');
  say('**AFTER** — rebuilt prompt, plain text, computed facts:');
  say('');
  say('> ' + a.split('\n').join('\n> '));
  say('');
  say(as.map(([n, ok]) => `  ${ok ? 'PASS' : 'FAIL'}  ${n}`).join('\n'));
  say('');
}

say('\n---');
say('');
say(`**Checks passed: before ${beforePassed}/${totalChecks}, after ${afterPassed}/${totalChecks}.**`);
say('');

fs.writeFileSync(path.join(OUT, 'chat-eval.md'), md.join('\n'));
console.log(`\n  written to ${path.join(OUT, 'chat-eval.md')}\n`);
