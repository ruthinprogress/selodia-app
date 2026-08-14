import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
import { logFoodFromText } from '../../lib/food-logging';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// One component of an itemised breakdown (build item 11); all fields optional.
// Duplicated from food-logging.ts pending the parse-prompt consolidation (item 28).
type ParsedItem = {
  name?: string;
  quantity?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sodium_mg?: number;
};

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { foodText, happenedAt, images } = await request.json();

  const content: any[] = [];

  if (images && images.length > 0) {
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.imageBase64,
        },
      });
    }
  }

  const hasImages = images && images.length > 0;

  // Text-only entries go through the shared logger (also used by the chat
  // handler). Image entries keep the multi-photo/label handling below.
  if (!hasImages) {
    try {
      const entry = await logFoodFromText(supabase, user.id, foodText, happenedAt);
      return NextResponse.json(entry);
    } catch (err) {
      console.log('PARSE-FOOD (text) ERROR:', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
    }
  }

  const textInstruction = hasImages
    ? 'These image(s) show food or food packaging (e.g. a nutrition label, a plate of food, a product). If multiple images are provided, they may show different angles or sides of the same item (e.g. a curved pot label split across two photos) - combine information across all images to get the most complete and accurate reading. When a label shows both "per 100g" and "per pot" or "per serving" values, always use the "per pot" or "per serving" total, not the per-100g figure, unless the person specifies they only ate part of it. UK nutrition labels typically show energy as both kJ and kcal together (e.g. "1049kJ/249kcal") - always use the kcal number, never the kJ number, for the kcal field. ' + (foodText ? 'The person also added this note: "' + foodText + '". Use the note to clarify or adjust what was actually eaten (e.g. "only ate half", "no dressing"). ' : '') + 'Estimate the macros for what was actually consumed. Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "breakdown_type": "simple" | "multi_component" | "consistent_ratio" | "high_variability", "items": [{"name": string, "quantity": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number}], "meal_label": string, "confidence": "clear" or "uncertain"} Set confidence to "uncertain" if any image was blurry, glare made text hard to read, or you had to guess at any number. For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack"). Keep it short - 1-3 words. Set breakdown_type and, when it warrants a breakdown, itemise into items: "simple" for a single or branded item like an apple or a branded yoghurt (items empty); "multi_component" for a meal of distinct parts like steak with a sauce (list each part); "consistent_ratio" for a composite whose make-up is usually consistent like lasagne (one item, items empty); "high_variability" for a composite that really varies like shakshuka or a full English (list each part with a quantity). Item macros should roughly sum to the totals; use a typical portion for quantity when it is not clear.'
    : 'Estimate the macros for this food entry. Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "breakdown_type": "simple" | "multi_component" | "consistent_ratio" | "high_variability", "items": [{"name": string, "quantity": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number}], "meal_label": string, "confidence": "clear" or "uncertain"} For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. Food entry: "' + foodText + '"';

  content.push({
    type: 'text',
    text: textInstruction,
  });

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    });
  } catch (err) {
    console.log('PARSE-FOOD ANTHROPIC ERROR:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
  }

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let macros;
  try {
    macros = JSON.parse(cleanedText);
  } catch (err) {
    console.log('PARSE-FOOD JSON PARSE ERROR:', cleanedText);
    return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: user.id,
      happened_at: happenedAt || new Date().toISOString(),
      raw_text: foodText || (hasImages ? '(photo upload)' : ''),
      meal_label: macros.meal_label,
      kcal: macros.kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      sodium_mg: macros.sodium_mg ?? null,
      breakdown_type: macros.breakdown_type ?? null,
      confidence: macros.confidence || 'clear',
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store the itemised breakdown (build item 11). Best-effort: the aggregate log
  // is what matters, so a missing breakdown never fails the log itself.
  const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('food_items').insert(
      items.map((it) => ({
        food_log_id: data[0].id,
        user_id: user.id,
        name: String(it.name ?? '').trim() || 'item',
        quantity: it.quantity ?? null,
        kcal: it.kcal ?? null,
        protein_g: it.protein_g ?? null,
        carbs_g: it.carbs_g ?? null,
        fat_g: it.fat_g ?? null,
        sodium_mg: it.sodium_mg ?? null,
      }))
    );
    if (itemsError) console.log('food_items insert failed (non-fatal):', itemsError.message);
  }

  return NextResponse.json(data[0]);
}