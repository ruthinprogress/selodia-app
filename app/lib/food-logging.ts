import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FOOD_PARSE_CLASSIFICATION_RULES,
  FOOD_PARSE_JSON_SCHEMA,
  aminoProfile, proteinSource,
  type ParsedItem,
  type ParsedMacros,
} from './food-parse-prompt';

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

// The food_logs column values derived from a parsed-macros object, shared by
// both parse paths (build item 28). The caller adds raw_text, user_id, and
// happened_at, which vary by path (a photo log's raw_text, an update preserving
// the original happened_at, etc.).
export function buildFoodLogFields(macros: ParsedMacros) {
  return {
    meal_label: macros.meal_label,
    kcal: macros.kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    sodium_mg: macros.sodium_mg ?? null,
    protein_source: proteinSource(macros.protein_source),
    amino_profile: aminoProfile(macros.amino_profile),
    breakdown_type: macros.breakdown_type ?? null,
    confidence: macros.confidence || 'clear',
  };
}

// Shared text-only food logging: extract macros via Haiku, insert into
// food_logs, return the stored row. Used by parse-food's text path AND by the
// chat handler (ask-unflump) for silent in-conversation logging. Throws on
// extraction/parse/insert failure so each caller decides how to surface it -
// parse-food returns 500; ask-unflump appends no confirmation (the
// storage-failure rule: never claim it saved when it did not). Image-based
// food logging stays in parse-food; it is deliberately out of the chat path.
// Writes the itemised components for a food log. Best-effort: the aggregate log
// is what matters, so a missing breakdown never fails the log itself. Exported
// so parse-food's image path reuses the same mapping (build item 28).
export async function writeItems(
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
      protein_source: proteinSource(it.protein_source),
      amino_profile: aminoProfile(it.amino_profile),
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
    'Estimate the macros for this food entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: ' +
    FOOD_PARSE_JSON_SCHEMA +
    ' ' +
    FOOD_PARSE_CLASSIFICATION_RULES +
    ' For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. Food entry: "' +
    foodText +
    '"';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: instruction }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const macros = JSON.parse(cleaned) as ParsedMacros;
  const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];

  // Shared macro/breakdown fields. happened_at is set only on insert; an update
  // (a clarification re-parse) preserves the original.
  const fields = {
    raw_text: foodText,
    ...buildFoodLogFields(macros),
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
