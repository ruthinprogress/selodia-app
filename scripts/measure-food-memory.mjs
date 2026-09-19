// Does handing the model a remembered value stop a staple drifting?
//
// Live: calls Haiku 2 x RUNS times, a few pence. Generic foods only.
//
//   npx tsx --env-file=.env.local scripts/measure-food-memory.mjs [runs]

import Anthropic from '@anthropic-ai/sdk';

import { FOOD_PARSE_CLASSIFICATION_RULES, FOOD_PARSE_ENTRIES_SCHEMA } from '../app/lib/food-parse-prompt.ts';
import { rememberedFoodsBlock } from '../app/lib/food-memory.ts';

const RUNS = Number(process.argv[2] ?? 3);
const TEXT = process.env.FOOD_TEXT ?? 'Two slices of wholemeal toast with a spoon of peanut butter and a banana';
const MEMORY = rememberedFoodsBlock([
  { name: 'Peanut butter', quantity: '1 spoon (16g)', kcal: 95, protein_g: 4.2, carbs_g: 3, fat_g: 8, created_at: '' },
  { name: 'Banana', quantity: '1 medium', kcal: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, created_at: '' },
]);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function once(memory) {
  const prompt =
    'The person described food they ate. Return one object in "entries" per MEAL, itemised. ' +
    'Estimate the macros for each entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: ' +
    FOOD_PARSE_ENTRIES_SCHEMA + ' ' + FOOD_PARSE_CLASSIFICATION_RULES +
    ' Set confidence to "clear" for typed text entries.' + memory + ' What they said: "' + TEXT + '"';
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  const items = parsed.entries.flatMap((e) => e.items ?? []);
  const pick = (re) => items.filter((i) => re.test(i.name)).map((i) => `${i.kcal}kcal/${i.protein_g}p`).join('+') || 'none';
  return { pb: pick(/peanut/i), banana: pick(/banana/i), names: items.map((i) => i.name).join(', ') };
}

for (const [label, memory] of [['WITHOUT memory', ''], ['WITH memory', MEMORY]]) {
  console.log(`\n  ${label}`);
  for (let i = 0; i < RUNS; i++) {
    const r = await once(memory);
    console.log(`    peanut butter ${r.pb.padEnd(14)} banana ${r.banana.padEnd(14)} [${r.names}]`);
  }
}
console.log('\n  With memory, peanut butter should read 95kcal/4.2p and banana 105kcal/1.3p every time.\n');
