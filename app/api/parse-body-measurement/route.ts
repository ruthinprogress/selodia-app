import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { measuredWhen } from '../../lib/measured-when';
import { getSupabaseForRequest } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { imageBase64, mediaType, measuredAt } = await request.json();

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'This is a screenshot from a body composition scale app (e.g. Zepp Life). Extract whichever of these fields are visible. Respond ONLY with valid JSON, no other text, in this exact format: {"weight_kg": number_or_null, "body_fat_pct": number_or_null, "muscle_kg": number_or_null, "bone_mass_kg": number_or_null, "water_pct": number_or_null, "visceral_fat": number_or_null, "bmr": number_or_null, "source_app": string, "measured_at": iso8601_string_or_null} Use null for any field not visible in the image. For source_app, name the app shown if identifiable (e.g. "Zepp Life"), otherwise "unknown". If weight is shown in a unit other than kg, convert to kg. For measured_at, look for a date and/or time shown in the screenshot itself (not today\'s date, the date the reading was actually taken). Return it as a full ISO 8601 datetime string. If a day and month are visible but no year, assume the CURRENT year, ' + new Date().getUTCFullYear() + ', rather than guessing a different year. If only a date is visible with no time, use 09:00:00 as a reasonable default time. If truly no date of any kind is visible anywhere in the screenshot, return null for measured_at.',
          },
        ],
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleanedText);

  // THE YEAR THE MODEL READ IS NOT TRUSTED (Ruth, 24 September 2026). Her scale
  // screenshot came back as 2024-09-24 and was filed two years ago, which made
  // the app describe yesterday's reading while showing today's figures. The
  // prompt above already asks for the current year in as many words. See
  // app/lib/measured-when.ts.
  const when = measuredWhen(parsed.measured_at || measuredAt, new Date());
  const finalMeasuredAt = when.iso;
  if (when.corrected) console.log('MEASUREMENT DATE:', when.corrected);

  const measuredDate = new Date(finalMeasuredAt);
  const dayStart = new Date(Date.UTC(measuredDate.getUTCFullYear(), measuredDate.getUTCMonth(), measuredDate.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { data: existing } = await supabase
    .from('body_measurements')
    .select('*')
    .gte('measured_at', dayStart.toISOString())
    .lt('measured_at', dayEnd.toISOString());

  const measurementData = {
    user_id: user.id,
    measured_at: finalMeasuredAt,
    weight_kg: parsed.weight_kg,
    body_fat_pct: parsed.body_fat_pct,
    muscle_kg: parsed.muscle_kg,
    bone_mass_kg: parsed.bone_mass_kg,
    water_pct: parsed.water_pct,
    visceral_fat: parsed.visceral_fat,
    bmr: parsed.bmr,
    source_app: parsed.source_app,
    raw_input: 'screenshot upload',
  };

  const forceReplace = request.headers.get('x-force-replace') === 'true';

  if (existing && existing.length > 0 && !forceReplace) {
    return NextResponse.json({
      duplicate: true,
      existingEntry: existing[0],
      newData: measurementData,
    });
  }

  if (existing && existing.length > 0) {
    const { data, error } = await supabase
      .from('body_measurements')
      .update(measurementData)
      .eq('id', existing[0].id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ...data[0], replaced: true });
  }

  const { data, error } = await supabase
    .from('body_measurements')
    .insert(measurementData)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data[0]);
}