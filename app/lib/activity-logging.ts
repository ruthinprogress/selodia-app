import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Coerce the model's log-time activity classification (build items 27 + 33) to a
// valid enum value or null, so a stray value can never violate the DB check
// constraint and fail the whole log. Shared with the screenshot path
// (parse-activity/route.ts), which inserts the same two columns — the one piece
// genuinely duplicated across the two otherwise-different activity parse paths
// (the prompts themselves are not shared: the tasks and schemas differ).
export const coerceIntensity = (v: unknown): 'light' | 'moderate' | 'intense' | null =>
  v === 'light' || v === 'moderate' || v === 'intense' ? v : null;
export const coerceEccentricLoad = (v: unknown): 'none' | 'low' | 'moderate' | 'high' | null =>
  v === 'none' || v === 'low' || v === 'moderate' || v === 'high' ? v : null;

// One activity object as the parse model returns it (all fields optional — the
// model may omit any; intensity/eccentric_load are coerced valid-or-null before
// insert). Shared with the screenshot path (parse-activity/route.ts).
export type ParsedActivity = {
  activity_type?: string;
  duration_min?: number;
  kcal_burned?: number;
  notes?: string | null;
  intensity?: unknown;
  eccentric_load?: unknown;
};

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
    '. If they mention a relative date (e.g. "yesterday", "on Monday", "two days ago", "this morning"), calculate the actual date they mean and return it as detected_date in ISO 8601 format (just the date, e.g. "2026-07-30"). If no date is mentioned, return null for detected_date and the current time will be used instead. If they describe MULTIPLE distinct activities (e.g. "1.5 hours ballet then 1 hour yoga"), split them into SEPARATE entries in the activities array, each with its own duration and calorie estimate - do not combine them into one entry. Estimate duration and calories burned for each based on the activity type and any intensity clues mentioned (e.g. "moderate", "intense", "easy"). Also classify two things per activity from the description. "intensity": how hard it was — "light" (gentle/easy, e.g. a stroll or restorative yoga), "moderate", or "intense" (vigorous, near-max, "to failure") — or null if the description gives no cue. "eccentric_load": the eccentric (lengthening-under-load) muscle stress that drives next-day soreness — "high" for downhill or hilly running, heavy slow lowering, plyometrics, or long eccentric-heavy sessions; "moderate" for ordinary resistance training or hilly hikes; "low" for mostly-concentric or light resistance; "none" for steady cycling, swimming, or easy flat walking — or null if unclear. Respond ONLY with valid JSON, no other text, in this exact format: {"activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "notes": string_or_null, "intensity": "light" | "moderate" | "intense" | null, "eccentric_load": "none" | "low" | "moderate" | "high" | null}], "source": "manual text", "detected_date": iso8601_date_string_or_null} Activity description: "' +
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

  const rowsToInsert = parsed.activities.map((activity: ParsedActivity) => ({
    user_id: userId,
    happened_at: finalHappenedAt,
    activity_type: activity.activity_type,
    duration_min: activity.duration_min,
    kcal_burned: activity.kcal_burned,
    source: parsed.source,
    raw_input: activityText,
    notes: activity.notes,
    intensity: coerceIntensity(activity.intensity),
    eccentric_load: coerceEccentricLoad(activity.eccentric_load),
  }));

  const { data, error } = await supabase.from('activity_logs').insert(rowsToInsert).select();
  if (error) throw new Error('activity_logs insert failed: ' + error.message);
  return data as ActivityEntry[];
}
