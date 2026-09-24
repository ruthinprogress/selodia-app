import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
import { buildFoodLogFields, logFoodFromText, writeItems } from '../../lib/food-logging';
import { loadRememberedFoods, rememberedFoodsBlock } from '../../lib/food-memory';
import {
  FOOD_PARSE_CLASSIFICATION_RULES,
  FOOD_PARSE_OMIT_RATHER_THAN_GUESS,
  FOOD_PARSE_JSON_SCHEMA,
  type ParsedItem,
  type ParsedMacros,
} from '../../lib/food-parse-prompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// "Photo: cheese omelette, rocket, cherry tomatoes" - the items the model
// named, in its order, short enough to read as a log line. Null when it named
// nothing, which falls back to the old placeholder rather than an empty string.
function photoDescription(macros: ParsedMacros): string | null {
  const names = (Array.isArray(macros.items) ? macros.items : [])
    .map((it) => (typeof it?.name === 'string' ? it.name.trim() : ''))
    .filter((n) => n.length > 0);
  if (names.length === 0) return null;
  const joined = names.join(', ');
  const line = `Photo: ${joined}`;
  return line.length > 120 ? `${line.slice(0, 119).trimEnd()}…` : line;
}

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

  const content: Anthropic.ContentBlockParam[] = [];

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

  // Image-only prompt: text-only entries already returned above via the shared
  // logger, so this path always has images. The image-specific framing
  // (multi-photo, label per-pot/kJ rules, note handling, photo confidence) stays
  // here; the JSON schema and classification rules are shared (build item 28).
  const textInstruction =
    'These image(s) show food or food packaging (e.g. a nutrition label, a plate of food, a product). If multiple images are provided, they may show different angles or sides of the same item (e.g. a curved pot label split across two photos) - combine information across all images to get the most complete and accurate reading. When a label shows both "per 100g" and "per pot" or "per serving" values, always use the "per pot" or "per serving" total, not the per-100g figure, unless the person specifies they only ate part of it. UK nutrition labels typically show energy as both kJ and kcal together (e.g. "1049kJ/249kcal") - always use the kcal number, never the kJ number, for the kcal field. ' +
    (foodText
      ? 'The person also added this note: "' + foodText + '". Use the note to clarify or adjust what was actually eaten (e.g. "only ate half", "no dressing"). '
      : '') +
    // NAME IT BEFORE WEIGHING IT (Ruth's bug list, item 8: "an omelette was read
    // as a baked potato"). The instruction used to go straight to macros, so
    // the identification happened silently inside the arithmetic and a wrong
    // guess arrived looking exactly as confident as a right one. Now the items
    // must be named as the person would name them, and a food the model cannot
    // tell apart from a look-alike is marked uncertain rather than guessed.
    'FIRST decide exactly what is on the plate, and name each item the way the person who ate it would name it - "cheese omelette", not "egg dish". Look closely before you name anything: foods of a similar colour and shape are easy to confuse (an omelette, a frittata, a jacket potato and a slice of quiche can all look alike), so check the texture, the edges and what is around it. If you genuinely cannot tell what a food is, give your best reading as its name AND set confidence to "uncertain" - a flagged guess can be corrected, a confident wrong one just sits in the log. ' +
    'Then estimate the macros for what was actually consumed. Respond ONLY with valid JSON, no other text, in this exact format: ' +
    FOOD_PARSE_JSON_SCHEMA +
    ' Set confidence to "uncertain" if any image was blurry, glare made text hard to read, or you had to guess at any number. For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack"). Keep it short - 1-3 words. ' +
    FOOD_PARSE_CLASSIFICATION_RULES +
    FOOD_PARSE_OMIT_RATHER_THAN_GUESS +
    // Only her note can be matched before the photo is seen; a photo with no
    // note gets no memory rather than a guess at what might be on the plate.
    rememberedFoodsBlock(await loadRememberedFoods(supabase, user.id, foodText ?? ''));

  content.push({
    type: 'text',
    text: textInstruction,
  });

  let message;
  try {
    message = await anthropic.messages.create({
      // SONNET FOR THE PHOTO PATH ONLY (2026-09-19). Every other food parse is
      // reading words, where the small model is fine. This one has to see, and
      // telling an omelette from a jacket potato on a plate is exactly where a
      // small vision model gets it wrong. Photo logs are a small share of all
      // logs, so the cost of seeing properly is small - see the spec, Part
      // Sixteen, item 8.
      model: 'claude-sonnet-5',
      max_tokens: 700,
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

  let macros: ParsedMacros;
  try {
    macros = JSON.parse(cleanedText) as ParsedMacros;
  } catch {
    console.log('PARSE-FOOD JSON PARSE ERROR:', cleanedText);
    return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: user.id,
      happened_at: happenedAt || new Date().toISOString(),
      // WHAT IT SAW, NOT "(photo upload)" (2026-09-19). Every photo entry used
      // to be stored under the same placeholder, so a misreading was invisible
      // in the log - nobody could see it had called an omelette a potato, and
      // so nobody could correct it. The entry now carries the items the model
      // named, which is both her record and the thing she can check at a
      // glance. Her own note, when she gave one, still wins.
      raw_text: foodText || photoDescription(macros) || (hasImages ? '(photo upload)' : ''),
      ...buildFoodLogFields(macros),
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store the itemised breakdown (build item 11) via the shared writer, the same
  // mapping the text path uses (build item 28).
  const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];
  await writeItems(supabase, data[0].id, user.id, items);

  return NextResponse.json(data[0]);
}