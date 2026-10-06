// DOES THE MODEL COPY ITS OWN EARLIER DENIAL?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-denial-echo.mjs
//
// Fourth failure of the same question on 6 October, after the cause had been
// found and fixed twice over: the macro block is built and correct, the meal
// lines carry the figures, turn_context selects the columns, and production is
// eleven commits past the fix.
//
// WHAT HAS NEVER BEEN TESTED is the thread. Her conversation contains several
// confident assistant turns saying the figure does not exist - one of them
// immediately before the message she just sent. The reply prompt already
// documents this exact failure mode for a different phrase: "the last forty
// turns are in your context, most of them opened that way, and you copied
// yourself - so the more it happens the more it happens."
//
// If that is what is happening, no amount of fixing the context will help,
// because the context is not what the model is reading.
//
// TWO RUNS, IDENTICAL EXCEPT FOR THE HISTORY.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { replyPrompt } = await import(root + '/app/lib/reply-prompt.ts');
const { buildTrackedMacroBlock, MACRO_COLUMN, trackedMacroKeys } = await import(
  root + '/app/lib/tracked-macro-summary.ts'
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

const USER = '37ce3854-b805-4dd6-95f1-0a670e67d27d';
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const { data: profile } = await supabase
  .from('user_profile')
  .select('tracked_macros')
  .eq('user_id', USER)
  .maybeSingle();

const keys = trackedMacroKeys(profile?.tracked_macros ?? null);
const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
const { data: food } = await supabase
  .from('food_logs')
  .select('happened_at, raw_text, kcal, protein_g, fat_g, saturated_fat_g, carbs_g, sugar_g, fibre_g, sodium_mg')
  .eq('user_id', USER)
  .gte('happened_at', since)
  .order('happened_at', { ascending: false })
  .limit(40);

// The meal lines exactly as the route renders them.
const mealMacros = (f) => {
  const shown = keys
    .map((k) => {
      const c = MACRO_COLUMN[k];
      const v = f[c.column];
      return typeof v === 'number'
        ? `${Math.round(v)}${c.unit === 'mg sodium' ? 'mg' : 'g'} ${c.label}`
        : null;
    })
    .filter(Boolean);
  return shown.length > 0 ? ', ' + shown.join(', ') : '';
};
const foodSummary = (food ?? [])
  .map(
    (f) =>
      `${f.happened_at.slice(0, 10)}: ${f.raw_text} (${f.kcal}kcal, ${f.protein_g}g protein${mealMacros(f)})`
  )
  .join('\n');

const macroBlock = await buildTrackedMacroBlock(supabase, USER, profile?.tracked_macros ?? null);

const personContext = `Here is their food log from the last 7 days:\n${foodSummary}${macroBlock}`;
const system = replyPrompt({ voice: false }) + '\n\n' + personContext;

console.log(`\n  meal lines: ${(food ?? []).length}, first one:`);
console.log('  ' + foodSummary.split('\n')[0]);
console.log(`  macro block: ${macroBlock.length} characters\n`);

const QUESTION = 'How much saturated fat have I had this week';

/** The denials actually in her thread, from chat_messages. */
const DENIALS = [
  { role: 'user', content: 'What about saturated fat in the past week?' },
  {
    role: 'assistant',
    content:
      "That's not something tracked here - the log has calories and protein, but not a saturated fat breakdown, so there's no figure to compare against anything for you.",
  },
  { role: 'user', content: 'Thats not true. Try agsin' },
  {
    role: 'assistant',
    content:
      "I don't have that figure - saturated fat isn't something that's broken out in your log, only calories and protein are. So I genuinely can't tell you a number for this week, not even roughly.",
  },
];

async function ask(messages, label) {
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 600,
    system,
    messages,
  });
  const text = r.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const denied = /don't have|do not have|isn't something|not something tracked|can't tell you/i.test(text);
  console.log(`${'='.repeat(72)}\n  ${label}  ${denied ? '*** STILL DENIES ***' : '[answers]'}\n${'='.repeat(72)}\n`);
  console.log(text + '\n');
}

await ask([{ role: 'user', content: QUESTION }], 'A FRESH THREAD');
await ask([...DENIALS, { role: 'user', content: QUESTION }], 'AFTER ITS OWN DENIALS');
