import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ActivityEntry = {
  id: string;
  activity_type: string;
  duration_min: number;
  kcal_burned: number;
  notes: string | null;
  source: string;
};

// Shared text-only activity logging, mirroring logFoodFromText. Extracts one or
// more activities via Haiku (splitting multi-activity descriptions, resolving
// relative dates), inserts into activity_logs, returns the stored rows. Throws
// on failure. Screenshot-based activity logging stays in parse-activity, out of
// the chat path.
export async function logActivityFromText(
  supabase: SupabaseClient,
  userId: string,
  activityText: string,
  happenedAt?: string
): Promise<ActivityEntry[]> {
  const instruction =
    'The person described one or more physical activities in free text. Today\'s date is ' +
    new Date().toISOString().slice(0, 10) +
    '. If they mention a relative date (e.g. "yesterday", "on Monday", "two days ago", "this morning"), calculate the actual date they mean and return it as detected_date in ISO 8601 format (just the date, e.g. "2026-07-30"). If no date is mentioned, return null for detected_date and the current time will be used instead. If they describe MULTIPLE distinct activities (e.g. "1.5 hours ballet then 1 hour yoga"), split them into SEPARATE entries in the activities array, each with its own duration and calorie estimate - do not combine them into one entry. Estimate duration and calories burned for each based on the activity type and any intensity clues mentioned (e.g. "moderate", "intense", "easy"). Respond ONLY with valid JSON, no other text, in this exact format: {"activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "notes": string_or_null}], "source": "manual text", "detected_date": iso8601_date_string_or_null} Activity description: "' +
    activityText +
    '"';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: instruction }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  let finalHappenedAt = happenedAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(happenedAt || new Date().toISOString()).toISOString().slice(11, 19);
    finalHappenedAt = parsed.detected_date + 'T' + timeOnly;
  }

  const rowsToInsert = parsed.activities.map((activity: any) => ({
    user_id: userId,
    happened_at: finalHappenedAt,
    activity_type: activity.activity_type,
    duration_min: activity.duration_min,
    kcal_burned: activity.kcal_burned,
    source: parsed.source,
    raw_input: activityText,
    notes: activity.notes,
  }));

  const { data, error } = await supabase.from('activity_logs').insert(rowsToInsert).select();
  if (error) throw new Error('activity_logs insert failed: ' + error.message);
  return data as ActivityEntry[];
}
