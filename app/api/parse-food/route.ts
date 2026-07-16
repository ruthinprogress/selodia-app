import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const { foodText } = await request.json();

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Estimate the macros for this food entry. Respond ONLY with valid JSON, no other text, in this exact format: {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "meal_label": string}

Food entry: "${foodText}"`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const macros = JSON.parse(cleanedText);

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      happened_at: new Date().toISOString(),
      raw_text: foodText,
      meal_label: macros.meal_label,
      kcal: macros.kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0]);
}