import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
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

  const textInstruction = hasImages
    ? 'These image(s) show food or food packaging (e.g. a nutrition label, a plate of food, a product). If multiple images are provided, they may show different angles or sides of the same item (e.g. a curved pot label split across two photos) - combine information across all images to get the most complete and accurate reading. When a label shows both "per 100g" and "per pot" or "per serving" values, always use the "per pot" or "per serving" total, not the per-100g figure, unless the person specifies they only ate part of it. UK nutrition labels typically show energy as both kJ and kcal together (e.g. "1049kJ/249kcal") - always use the kcal number, never the kJ number, for the kcal field. ' + (foodText ? 'The person also added this note: "' + foodText + '". Use the note to clarify or adjust what was actually eaten (e.g. "only ate half", "no dressing"). ' : '') + 'Estimate the macros for what was actually consumed. Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "meal_label": string, "confidence": "clear" or "uncertain"} Set confidence to "uncertain" if any image was blurry, glare made text hard to read, or you had to guess at any number. For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack"). Keep it short - 1-3 words.'
    : 'Estimate the macros for this food entry. Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "meal_label": string, "confidence": "clear" or "uncertain"} For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. Food entry: "' + foodText + '"';

  content.push({
    type: 'text',
    text: textInstruction,
  });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: content,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const macros = JSON.parse(cleanedText);

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      happened_at: happenedAt || new Date().toISOString(),
      raw_text: foodText || (hasImages ? '(photo upload)' : ''),
      meal_label: macros.meal_label,
      kcal: macros.kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      confidence: macros.confidence || 'clear',
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0]);
}