// HOW OFTEN IS A TURN ACTUALLY ABOUT THE APP?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/probe-app-question-trigger.mjs
//
// APP_STRUCTURE_PROMPT_BLOCK is 12,182 characters - the single largest
// instruction in the prompt, read by both calls of every typed turn. It is an
// accurate map of every screen, and almost none of it bears on a weigh-in or a
// food log: nothing about logging porridge needs to know that holding a row in
// the Log tab reorders it.
//
// The obvious move is to send it only when the turn is about the app. The
// obvious move is also how a model ends up unable to answer "where do I find
// my weight log", or - worse, and explicitly forbidden in that same block -
// inventing a control that does not exist.
//
// So the trigger is measured against real messages before anything is built:
// how often would it fire, and what does it catch and miss. Read-only, and it
// prints the messages themselves so the misses can be judged rather than
// counted.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// DELIBERATELY GENEROUS. Over-firing costs exactly what today costs; missing
// costs an answer about her own app. Anything that smells of a screen, a
// control, a tab, finding something, or the app itself.
const ABOUT_THE_APP =
  /\b(app|tab|screen|page|button|menu|setting|settings|icon|where|find|show me|how do i|how can i|can i|is there|navigate|open|click|tap|swipe|log tab|me tab|plans|almanac|report|export|delete my|account|notification|reminder|profile|dashboard|chart|graph|view|edit|remove|turn off|turn on)\b/i;

const { data: rows, error } = await supabase
  .from('chat_messages')
  .select('content, created_at')
  .eq('role', 'user')
  .order('created_at', { ascending: false })
  .limit(600);
if (error) throw new Error(error.message);

const messages = (rows ?? []).map((r) => String(r.content ?? '')).filter((m) => m.trim().length > 0);
const fires = messages.filter((m) => ABOUT_THE_APP.test(m));

console.log(`\n  ${messages.length} real user messages\n`);
console.log(`  the trigger fires on ${fires.length} (${((100 * fires.length) / messages.length).toFixed(0)}%)`);
console.log(`  so ${messages.length - fires.length} turns would not carry the 12,182-character map\n`);

console.log('  --- a sample it would SKIP (these must not need the map) ---');
for (const m of messages.filter((x) => !ABOUT_THE_APP.test(x)).slice(0, 12)) {
  console.log(`    ${m.replace(/\s+/g, ' ').slice(0, 96)}`);
}

console.log('\n  --- a sample it would CARRY ---');
for (const m of fires.slice(0, 8)) {
  console.log(`    ${m.replace(/\s+/g, ' ').slice(0, 96)}`);
}
console.log('');
