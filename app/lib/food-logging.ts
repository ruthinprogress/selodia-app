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

// One component of an itemised breakdown (build item 11). All fields optional -
// the model may omit any, and name is coerced non-empty before insert.
type ParsedItem = {
  name?: string;
  quantity?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sodium_mg?: number;
};

// Shared text-only food logging: extract macros via Haiku, insert into
// food_logs, return the stored row. Used by parse-food's text path AND by the
// chat handler (ask-unflump) for silent in-conversation logging. Throws on
// extraction/parse/insert failure so each caller decides how to surface it -
// parse-food returns 500; ask-unflump appends no confirmation (the
// storage-failure rule: never claim it saved when it did not). Image-based
// food logging stays in parse-food; it is deliberately out of the chat path.
// Writes the itemised components for a food log. Best-effort: the aggregate log
// is what matters, so a missing breakdown never fails the log itself.
async function writeItems(
  supabase: SupabaseClient,
  foodLogId: string,
  userId: string,
  items: ParsedItem[]
) {
  if (items.length === 0) return;
  const { error } = await supabase.from('food_items').insert(
    items.map((it) => ({
      food_log_id: foodLogId,
      user_id: userId,
      name: String(it.name ?? '').trim() || 'item',
      quantity: it.quantity ?? null,
      kcal: it.kcal ?? null,
      protein_g: it.protein_g ?? null,
      carbs_g: it.carbs_g ?? null,
      fat_g: it.fat_g ?? null,
      sodium_mg: it.sodium_mg ?? null,
    }))
  );
  if (error) console.log('food_items insert failed (non-fatal):', error.message);
}

// updateLogId, when given, re-parses foodText and UPDATES that existing log in
// place (replacing its items) instead of inserting a new one - used to resolve a
// consistent-ratio clarification with an enriched description (build item 11,
// slice 2a). An update preserves the original happened_at.
export async function logFoodFromText(
  supabase: SupabaseClient,
  userId: string,
  foodText: string,
  happenedAt?: string,
  updateLogId?: string
): Promise<FoodEntry> {
  const instruction =
    'Estimate the macros for this food entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "breakdown_type": "simple" | "multi_component" | "consistent_ratio" | "high_variability", "items": [{"name": string, "quantity": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number}], "meal_label": string, "confidence": "clear" or "uncertain"} Set breakdown_type and, when it warrants a breakdown, itemise into items: "simple" for a single or branded item like an apple or a branded yoghurt (items empty); "multi_component" for a meal of distinct parts like steak with a sauce (list each part); "consistent_ratio" for a composite whose make-up is usually consistent like lasagne (one item, items empty); "high_variability" for a composite that really varies like shakshuka or a full English (list each part with a quantity). Item macros should roughly sum to the totals; use the person\'s own portion words for quantity, or a typical portion if none given. For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. Food entry: "' +
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
  const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];

  // Shared macro/breakdown fields. happened_at is set only on insert; an update
  // (a clarification re-parse) preserves the original.
  const fields = {
    raw_text: foodText,
    meal_label: macros.meal_label,
    kcal: macros.kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    sodium_mg: macros.sodium_mg ?? null,
    breakdown_type: macros.breakdown_type ?? null,
    confidence: macros.confidence || 'clear',
  };

  if (updateLogId) {
    const { data, error } = await supabase
      .from('food_logs')
      .update(fields)
      .eq('id', updateLogId)
      .select();
    if (error) throw new Error('food_logs update failed: ' + error.message);
    const entry = data[0] as FoodEntry;
    await supabase.from('food_items').delete().eq('food_log_id', updateLogId);
    await writeItems(supabase, updateLogId, userId, items);
    return entry;
  }

  const { data, error } = await supabase
    .from('food_logs')
    .insert({ user_id: userId, happened_at: happenedAt || new Date().toISOString(), ...fields })
    .select();
  if (error) throw new Error('food_logs insert failed: ' + error.message);
  const entry = data[0] as FoodEntry;
  await writeItems(supabase, entry.id, userId, items);
  return entry;
}
