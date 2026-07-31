import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
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

  const textInstruction = hasImages
    ? 'This image is a screenshot from a fitness tracking app (e.g. Samsung Health). It could be either: (a) a DAILY SUMMARY screen showing total steps, active time, activity calories, total burnt calories, and distance for a whole day, or (b) a SPECIFIC WORKOUT screen showing one activity (e.g. a run) with details like distance, pace, duration, cadence. Identify which type this is. If it is a daily summary, respond with ONE activity object: activity_type "Daily Summary", duration_min = active time shown, kcal_burned = total burnt calories figure, and notes should include steps and distance if shown (e.g. "10,228 steps, 7.33km"). If it is a specific workout, respond with ONE activity object: activity_type = the activity name (e.g. "Running"), duration_min = its duration, kcal_burned = its calorie figure, notes = distance/pace/cadence/incline as a short readable summary. ' + (activityText ? 'The person also added this note: "' + activityText + '". ' : '') + 'Respond ONLY with valid JSON, no other text, in this exact format: {"activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "notes": string_or_null}], "source": "Samsung daily summary" or "Samsung workout screenshot"}'
    : 'The person described one or more physical activities in free text. Today\'s date is ' + new Date().toISOString().slice(0, 10) + '. If they mention a relative date (e.g. "yesterday", "on Monday", "two days ago", "this morning"), calculate the actual date they mean and return it as detected_date in ISO 8601 format (just the date, e.g. "2026-07-30"). If no date is mentioned, return null for detected_date and the current time will be used instead. If they describe MULTIPLE distinct activities (e.g. "1.5 hours ballet then 1 hour yoga"), split them into SEPARATE entries in the activities array, each with its own duration and calorie estimate - do not combine them into one entry. Estimate duration and calories burned for each based on the activity type and any intensity clues mentioned (e.g. "moderate", "intense", "easy"). Respond ONLY with valid JSON, no other text, in this exact format: {"activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "notes": string_or_null}], "source": "manual text", "detected_date": iso8601_date_string_or_null} Activity description: "' + activityText + '"'

  content.push({
    type: 'text',
    text: textInstruction,
  });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: content,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  console.log('CLAUDE RAW RESPONSE:', responseText);
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleanedText);

let finalHappenedAt = happenedAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(happenedAt || new Date().toISOString()).toISOString().slice(11, 19);
    finalHappenedAt = parsed.detected_date + 'T' + timeOnly;
  }

  const rowsToInsert = parsed.activities.map((activity: any) => ({
    happened_at: finalHappenedAt,
    activity_type: activity.activity_type,
    duration_min: activity.duration_min,
    kcal_burned: activity.kcal_burned,
    source: parsed.source,
    raw_input: activityText || (hasImages ? '(screenshot upload)' : ''),
    notes: activity.notes,
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