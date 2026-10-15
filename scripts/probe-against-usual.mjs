// WOULD IT HAVE NOTICED THE QUIET WEEK?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-against-usual.mjs [YYYY-MM-DD]
//
// Ruth, 15 October 2026, writing the sentence she wanted on a weigh-in that
// followed three days of nothing logged while she had a fever: "bit of a drop
// in activity and increase in average intake of carbs and energy in general -
// looks like there might be something going on in your life - would you like
// to talk about it?"
//
// It could not be written. week-read.ts computed one seven-day window, so it
// could say what the week WAS and had nothing to say a drop against. The model
// had a sparse week, no baseline and no explanation, and filled the silence by
// inventing a hard session.
//
// This runs the new baseline over her real rows for that day and prints what
// the block would have handed the writer. Read-only.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = 'file://' + process.cwd().split('\\').join('/');
const { changesAgainstUsual, unusualSilence } = await import(root + '/app/lib/week-read.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const HER = '37ce3854-b805-4dd6-95f1-0a670e67d27d';
const today = process.argv[2] ?? '2026-10-15';
const from = new Date(Date.parse(`${today}T12:00:00Z`) - 40 * 86400000).toISOString();

const [{ data: food }, { data: activity }, { data: burn }] = await Promise.all([
  supabase.from('food_logs').select('happened_at, kcal, protein_g').eq('user_id', HER).gt('happened_at', from),
  supabase.from('activity_logs').select('happened_at, activity_type, duration_min, intensity').eq('user_id', HER).gt('happened_at', from),
  supabase.from('daily_burn').select('date, steps, kcal_burned').eq('user_id', HER).gt('date', from.slice(0, 10)),
]);

const input = {
  food: food ?? [],
  activity: activity ?? [],
  dailyBurn: burn ?? [],
  drinks: [],
  sleep: [],
  measurements: [],
  lastPeriod: null,
  today,
};

console.log(`\n  Her record to ${today}: ${input.food.length} food rows, ${input.activity.length} sessions, ${input.dailyBurn.length} days of steps\n`);

const loggedDays = [...new Set(input.activity.map((a) => String(a.happened_at).slice(0, 10)))].sort();
console.log('  days with a session logged:', loggedDays.join(', '));
const silence = unusualSilence(input);
console.log(`  unusual silence: ${silence ?? 'none detected'}
`);
const changes = changesAgainstUsual(input);
if (changes.length === 0) {
  console.log('  Nothing moved by more than a fifth. The block would say nothing, which is correct when it is correct.\n');
} else {
  console.log('  AGAINST THEIR OWN USUAL (this week vs the four weeks before it):');
  for (const c of changes) console.log(`    ${c}`);
  console.log(
    '\n  That is the fact her sentence needed. Before today the block had no baseline,\n' +
      '  so "a bit of a drop" was not available to say - and the model invented a reason instead.\n'
  );
}
