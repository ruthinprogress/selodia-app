import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
import { coerceEccentricLoad, coerceIntensity, logActivityFromText } from '../../lib/activity-logging';

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

  const { activityText, happenedAt, images } = await request.json();

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
  // handler). Screenshot entries keep the summary/workout handling below.
  if (!hasImages) {
    try {
      const entries = await logActivityFromText(supabase, user.id, activityText, happenedAt);
      return NextResponse.json({ entries });
    } catch (err) {
      console.log('PARSE-ACTIVITY (text) ERROR:', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
    }
  }

  // Image-only prompt: text-only entries already returned above via the shared
  // logger, so this path always has images. (The screenshot parse can rarely
  // determine eccentric_load — a summary screen shows no exertion detail — so
  // intensity/eccentric_load are best-effort here, null when not evident.)
  const textInstruction =
    'This image is a screenshot from a fitness tracking app (e.g. Samsung Health). It could be either: (a) a DAILY SUMMARY screen showing total steps, active time, activity calories, total burnt calories, and distance for a whole day, or (b) a SPECIFIC WORKOUT screen showing one activity (e.g. a run) with details like distance, pace, duration, cadence. Identify which type this is. If it is a daily summary, respond with ONE activity object: activity_type "Daily Summary", duration_min = active time shown, kcal_burned = total burnt calories figure, and notes should include steps and distance if shown (e.g. "10,228 steps, 7.33km"). If it is a specific workout, respond with ONE activity object: activity_type = the activity name (e.g. "Running"), duration_min = its duration, kcal_burned = its calorie figure, notes = distance/pace/cadence/incline as a short readable summary. ' + (activityText ? 'The person also added this note: "' + activityText + '". ' : '') + 'Where the screen makes it evident, also set "intensity" ("light" | "moderate" | "intense") and "eccentric_load" ("none" | "low" | "moderate" | "high" — the eccentric muscle stress that drives next-day soreness, e.g. higher for hilly/downhill running); use null for either when the screen does not make it clear. Respond ONLY with valid JSON, no other text, in this exact format: {"activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "notes": string_or_null, "intensity": "light" | "moderate" | "intense" | null, "eccentric_load": "none" | "low" | "moderate" | "high" | null}], "source": "Samsung daily summary" or "Samsung workout screenshot"}'

  content.push({
    type: 'text',
    text: textInstruction,
  });

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    });
  } catch (err) {
    console.log('PARSE-ACTIVITY ANTHROPIC ERROR:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
  }

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  console.log('CLAUDE RAW RESPONSE:', responseText);
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (err) {
    console.log('PARSE-ACTIVITY JSON PARSE ERROR:', cleanedText);
    return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
  }

let finalHappenedAt = happenedAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(happenedAt || new Date().toISOString()).toISOString().slice(11, 19);
    finalHappenedAt = parsed.detected_date + 'T' + timeOnly;
  }

  const rowsToInsert = parsed.activities.map((activity: any) => ({
    user_id: user.id,
    happened_at: finalHappenedAt,
    activity_type: activity.activity_type,
    duration_min: activity.duration_min,
    kcal_burned: activity.kcal_burned,
    source: parsed.source,
    raw_input: activityText || (hasImages ? '(screenshot upload)' : ''),
    notes: activity.notes,
    intensity: coerceIntensity(activity.intensity),
    eccentric_load: coerceEccentricLoad(activity.eccentric_load),
  }));

  const { data, error } = await supabase
    .from('activity_logs')
    .insert(rowsToInsert)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data });
}