import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type FoodEntry = {
  id: string;
  meal_label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: string;
};

// Shared text-only food logging: extract macros via Haiku, insert into
// food_logs, return the stored row. Used by parse-food's text path AND by the
// chat handler (ask-unflump) for silent in-conversation logging. Throws on
// extraction/parse/insert failure so each caller decides how to surface it -
// parse-food returns 500; ask-unflump appends no confirmation (the
// storage-failure rule: never claim it saved when it did not). Image-based
// food logging stays in parse-food; it is deliberately out of the chat path.
export async function logFoodFromText(
  supabase: SupabaseClient,
  userId: string,
  foodText: string,
  happenedAt?: string
): Promise<FoodEntry> {
  const instruction =
    'Estimate the macros for this food entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "meal_label": string, "confidence": "clear" or "uncertain"} For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. Food entry: "' +
    foodText +
    '"';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: instruction }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const macros = JSON.parse(cleaned);

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: userId,
      happened_at: happenedAt || new Date().toISOString(),
      raw_text: foodText,
      meal_label: macros.meal_label,
      kcal: macros.kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      sodium_mg: macros.sodium_mg ?? null,
      confidence: macros.confidence || 'clear',
    })
    .select();

  if (error) throw new Error('food_logs insert failed: ' + error.message);
  return data[0] as FoodEntry;
}
