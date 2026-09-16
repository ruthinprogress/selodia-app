// Why did a seven-day catch-up write nothing?
//
// Runs the EXACT parse the chat route runs, on the exact message Ruth sent on
// 2026-09-16, and reports what came back: the stop reason, the size, whether it
// is valid JSON, and how many entries survived the food guard. One Haiku call.
//
// Reads ANTHROPIC_API_KEY from .env.local and never prints it.
//
//   npx tsx scripts/repro-food-parse.mjs

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

import {
  FOOD_PARSE_CLASSIFICATION_RULES,
  FOOD_PARSE_ENTRIES_SCHEMA,
} from '../app/lib/food-parse-prompt.ts';
import { buildFoodRows } from '../app/lib/food-logging.ts';

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY='))?.slice('ANTHROPIC_API_KEY='.length).trim();
if (!key) throw new Error('No ANTHROPIC_API_KEY in .env.local');

const FOOD_TEXT = `Catch up my food log:

Mon 7th
Pizza and chips
Tuesday 8th
Burger, beer, salad with chicken
Weds 9th
Turkish feast with ribs
Thursday 10th
Lentil and rice plus apples

Fri 11th
Fritatta salmon
Sat 12th
Pasta carbonate
Sun 13th
Teabags and potatoes`;

const today = new Date().toISOString().slice(0, 10);

const instruction =
  'The person described food they ate, which may be one meal or several, and may cover more than one day. ' +
  `Today's date is ${today}. ` +
  'Return one object in "entries" per MEAL: split a message that describes several meals or several days into separate entries, and never merge two days into one. ' +
  'If an entry names a day - "Monday", "Mon 7th", "yesterday", "last Tuesday" - work out the actual date and return it as detected_date in ISO format (e.g. "2026-09-07"). A named day without a year means the most recent one that has already happened, never a future date. Return null for detected_date when no day is given, and the entry will be logged as today. ' +
  'Put the person\'s own words for that entry in entry_text. ' +
  // Kept in step with app/lib/food-logging.ts by hand, which is the point of
  // this script: it must run the prompt the route actually sends. Itemisation
  // came back on 2026-09-16 and this is what re-measures the cost of it.
  'ITEMISE EVERY ENTRY, however many there are: fill items with the real components of each meal. Keep it to what was actually described - around six items at most - rather than splitting a dish into ingredients nobody mentioned. ' +
  'IF THE TEXT DESCRIBES NO FOOD AT ALL - a question, a complaint that something did not save, a comment about logging - return {"entries": []}. Never invent a meal to fill the gap, and never treat a remark about the log as a meal. ' +
  'Estimate the macros for each entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: ' +
  FOOD_PARSE_ENTRIES_SCHEMA +
  ' ' +
  FOOD_PARSE_CLASSIFICATION_RULES +
  ' For meal_label on each entry, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. What they said: "' +
  FOOD_TEXT +
  '"';

const MAX_TOKENS = Number(process.argv[2] ?? 2000);
console.log(`\n  instruction: ${instruction.length} chars, max_tokens ${MAX_TOKENS}\n`);

const anthropic = new Anthropic({ apiKey: key });
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: MAX_TOKENS,
  messages: [{ role: 'user', content: instruction }],
});

console.log('  stop_reason:', message.stop_reason);
console.log('  output tokens:', message.usage.output_tokens);
const text = message.content[0].type === 'text' ? message.content[0].text : '';
console.log('  response chars:', text.length);
console.log('  last 80 chars:', JSON.stringify(text.slice(-80)));

const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
try {
  const parsed = JSON.parse(cleaned);
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  console.log(`\n  PARSED OK: ${entries.length} entries`);
  for (const e of entries) {
    console.log(`    ${e.detected_date ?? 'no date'}  ${e.kcal ?? '?'} kcal  ${JSON.stringify(e.entry_text ?? '').slice(0, 50)}  items: ${(e.items ?? []).length}`);
  }
  const rows = buildFoodRows(parsed, FOOD_TEXT, new Date());
  console.log(`\n  ROWS THAT WOULD BE WRITTEN: ${rows.length}`);
  for (const r of rows) console.log(`    ${r.happenedAt.slice(0, 10)}  ${r.fields.kcal} kcal  ${r.rawText.slice(0, 40)}`);
} catch (err) {
  console.log('\n  JSON.parse FAILED:', err.message);
  console.log('  This is the failure the route reports as "didn\'t save for some reason".');
}
console.log('');
