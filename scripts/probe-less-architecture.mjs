// IS THE SCAFFOLDING MAKING IT WORSE?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-less-architecture.mjs
//
// Ruth, 15 October 2026, after four weigh-in cards each told her she "did a
// hard session a day or two ago" when her last logged activity was fifteen
// minutes of light running three days earlier: "but why would it do that?
// Claude doesn't do that." And then, more precisely: "My point was that maybe
// there's too much architechture around it, limiting it's thinking."
//
// THAT IS A HYPOTHESIS AND IT IS TESTABLE, so it is tested rather than argued
// with. A led turn sends about 45,000 tokens of standing instruction. Her own
// Claude project sends the data and a question.
//
// ARM A IS ALREADY MEASURED - in production, four times, and she photographed
// all four. This runs ARM B: the same facts, read from her real record, with
// a short brief and nothing else, and prints what comes back.
//
// WHAT TO LOOK FOR, and it is not prose quality:
//   1. Does it invent a hard session? The record does not contain one.
//   2. Does it notice the three-day gap in a log that is otherwise daily?
//   3. Does it use the figure the app computed, or recompute its own?
//
// READ-ONLY. It reads her record and writes nothing anywhere.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// The account the readings belong to, by id rather than by address: the
// address she signs in with is not the one this machine knows her by, and
// a lookup that missed sent this probe looking for a fault that was not there.
const her = { id: '37ce3854-b805-4dd6-95f1-0a670e67d27d' };

const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

const { data: activity } = await supabase
  .from('activity_logs')
  .select('happened_at, activity_type, duration_min, intensity, eccentric_load')
  .eq('user_id', her.id)
  .gt('happened_at', since)
  .order('happened_at', { ascending: false });

const { data: body } = await supabase
  .from('body_measurements')
  .select('measured_at, weight_kg, body_fat_pct, muscle_kg')
  .eq('user_id', her.id)
  .gt('measured_at', since)
  .order('measured_at', { ascending: false });

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// THE RECORD, AS PLAINLY AS IT CAN BE PUT. One line per day of movement
// INCLUDING THE DAYS WITH NOTHING ON THEM, which is the thing the live prompt
// does not do once the window is partly populated.
const days = [];
for (let i = 13; i >= 0; i -= 1) {
  const d = new Date(Date.now() - i * 24 * 3600 * 1000);
  const key = d.toISOString().slice(0, 10);
  const onDay = (activity ?? []).filter((a) => String(a.happened_at).slice(0, 10) === key);
  days.push(
    `${day(d.toISOString())}: ${
      onDay.length === 0
        ? 'nothing logged'
        : onDay.map((a) => `${a.activity_type}${a.duration_min ? ` ${a.duration_min} min` : ''}${a.intensity ? `, ${a.intensity}` : ''}`).join('; ')
    }`
  );
}

const weights = (body ?? [])
  .slice(0, 10)
  .map((b) => `${day(b.measured_at)}: ${b.weight_kg} kg, body fat ${b.body_fat_pct}%, muscle ${b.muscle_kg} kg`)
  .reverse();

const LEAN = `You are Selodia, a health companion. Someone has just logged a weigh-in by photographing their scale. Write the short note that goes under the reading.

Say only what their record supports. If something is not recorded, it is not a fact about them.

THEIR MOVEMENT, one line per day, last fourteen days:
${days.join('\n')}

THEIR WEIGH-INS:
${weights.join('\n')}

Today's reading, already worked out by the app: 56.7 kg, up 0.6 kg on the reading six days ago. Body fat 27.9%, muscle 38.5 kg.

Write at most 80 words.`;

console.log('\n  ---- WHAT THE LEAN PROMPT IS GIVEN ----\n');
console.log(LEAN.replace(/^/gm, '  '));

const started = Date.now();
const message = await anthropic.messages.create({
  model: 'claude-opus-5-5',
  max_tokens: 2000,
  system: LEAN,
  messages: [{ role: 'user', content: '[scale photograph logged]' }],
  output_config: { effort: 'low' },
});
const reply = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

console.log(`\n  ---- WHAT IT SAID (${((Date.now() - started) / 1000).toFixed(1)}s, ${message.usage.input_tokens} input tokens) ----\n`);
console.log(reply.replace(/^/gm, '  '));

console.log('\n  ---- THE THREE QUESTIONS ----');
const invented = /you (did|had|'ve done)[^.]{0,40}(session|workout|training)/i.test(reply);
const noticed = /(nothing|no )[^.]{0,40}(logged|recorded)|gap|since the 12th|three days|quiet|rest/i.test(reply);
const ownNumber = /0\.6/.test(reply);
console.log(`  invents a hard session:      ${invented ? 'YES - the bug reproduces' : 'no'}`);
console.log(`  notices the gap in training: ${noticed ? 'yes' : 'NO'}`);
console.log(`  uses the app's own figure:   ${ownNumber ? 'yes' : 'no'}`);
console.log(
  `\n  For comparison, the live app sent about 45,000 tokens of standing instruction\n` +
    `  and produced the invented sentence four times. This arm sent ${message.usage.input_tokens}.\n`
);
