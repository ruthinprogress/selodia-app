import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeWeight } from './body-metrics';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Text-only body-measurement logging, mirroring logFoodFromText and
// logActivityFromText (build item 10c, 2026-08-26).
//
// WHY THIS EXISTS. Until now `logIntent` was 'none' | 'food' | 'activity' - that
// was the complete set. Typing "55.2 this morning" in chat logged NOTHING: the
// reply came back warm and the number went nowhere. The only two ways a weight
// had ever reached the database were the onboarding conversation and a
// photographed scale screenshot, which meant daily weight tracking required
// photographing the scale every single day. That is the difference between a
// habit and a chore, and it was the single largest gap in the core logging loop.
//
// Screenshot-based measurement logging stays in parse-body-measurement, exactly
// as photo activity logging stays in parse-activity.

export type MeasurementEntry = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
};

type ParsedMeasurement = {
  weight_kg: number | null;
  weight_lb: number | null;
  weight_stone: number | null;
  weight_stone_lb: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
  detected_date: string | null;
};

// Plausible human bodyweight in kg. Not a judgement about anyone - it is a
// guard against a misparse writing nonsense into the one table the
// interpretation layer reasons over. A number outside this range is far more
// likely to be a typo, a date, or a misread unit than a real weight.
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

// Body-fat and muscle are only accepted in ranges that could be a real reading.
const MIN_BODY_FAT_PCT = 2;
const MAX_BODY_FAT_PCT = 75;

function plausible(v: number | null, min: number, max: number): number | null {
  if (v == null || !isFinite(v)) return null;
  return v >= min && v <= max ? v : null;
}

export async function logMeasurementFromText(
  supabase: SupabaseClient,
  userId: string,
  measurementText: string,
  measuredAt?: string,
  // When set, the corrected values replace that row instead of inserting a new
  // one (build item 10d). A correction must never leave the wrong reading
  // behind alongside the right one - two readings minutes apart would look like
  // a re-weigh and both would feed the trend.
  updateId?: string
): Promise<MeasurementEntry | null> {
  const instruction =
    "The person stated a body measurement in free text. Today's date is " +
    new Date().toISOString().slice(0, 10) +
    '. Extract the numbers EXACTLY as expressed - do not convert units yourself, the app does that deterministically. ' +
    'Put the weight in whichever field matches how they said it: weight_kg for kilograms, weight_lb for pounds, ' +
    'weight_stone plus weight_stone_lb for stones and pounds (e.g. "8 stone 9" is weight_stone 8, weight_stone_lb 9). ' +
    'Leave the others null. If they give body fat percentage or muscle mass, include those; otherwise null. ' +
    'If they mention a relative date ("this morning", "yesterday", "on Monday"), calculate the actual date and return it ' +
    'as detected_date in ISO 8601 (just the date, e.g. "2026-08-26"); otherwise null. ' +
    'ONLY extract a measurement they have actually TAKEN. A weight they are aiming for, working toward, '
    + 'or hoping to reach is a GOAL, not a measurement - phrases like "my target is", "I want to get to", '
    + '"aiming for", "hoping to be", "down to" mean return every field as null. The same applies to any '
    + 'weight that is not theirs, or any number that is not a body measurement at all. ' +
    'Respond ONLY with valid JSON, no other text, in this exact format: ' +
    '{"weight_kg": number_or_null, "weight_lb": number_or_null, "weight_stone": number_or_null, ' +
    '"weight_stone_lb": number_or_null, "body_fat_pct": number_or_null, "muscle_kg": number_or_null, ' +
    '"detected_date": iso8601_date_string_or_null} Measurement: "' +
    measurementText +
    '"';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: instruction }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as ParsedMeasurement;

  // Unit conversion happens in code, never in the model (decision A, Part
  // Seven) - the same normalizeWeight the onboarding conversation uses, so a
  // weight stated in stone lands identically whichever route it arrives by.
  const weightKg = plausible(
    normalizeWeight({
      kg: parsed.weight_kg,
      lb: parsed.weight_lb,
      stone: parsed.weight_stone,
      stoneLb: parsed.weight_stone_lb,
    }),
    MIN_WEIGHT_KG,
    MAX_WEIGHT_KG
  );
  const bodyFatPct = plausible(parsed.body_fat_pct, MIN_BODY_FAT_PCT, MAX_BODY_FAT_PCT);
  const muscleKg = plausible(parsed.muscle_kg, 1, MAX_WEIGHT_KG);

  // Nothing usable. Returns null rather than writing an empty row: a row with
  // no numbers would still count as a reading everywhere downstream - breaking
  // a trend chain, and satisfying "they logged today" when they did not.
  if (weightKg == null && bodyFatPct == null && muscleKg == null) return null;

  let finalMeasuredAt = measuredAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(measuredAt || new Date().toISOString()).toISOString().slice(11, 19);
    finalMeasuredAt = parsed.detected_date + 'T' + timeOnly + 'Z';
  }

  // A correction replaces the row it is correcting. Otherwise: inserted, never
  // merged over a same-day reading - re-weighing in a day is normal, the
  // history is append-only, and everything downstream already takes the latest
  // reading of a day (see measurements-week.ts). The overwrite/skip prompt in
  // parse-body-measurement is for bulk screenshot imports, where the same
  // reading really can arrive twice; a typed number cannot.
  if (updateId) {
    const { data, error } = await supabase
      .from('body_measurements')
      .update({
        measured_at: finalMeasuredAt,
        weight_kg: weightKg,
        body_fat_pct: bodyFatPct,
        muscle_kg: muscleKg,
        raw_input: measurementText,
      })
      .eq('id', updateId)
      // RLS already scopes this, but the explicit filter means a wrong id can
      // never reach another person's row even if a policy is later relaxed.
      .eq('user_id', userId)
      .select();
    if (error) throw new Error('body_measurements update failed: ' + error.message);
    return (data?.[0] as MeasurementEntry) ?? null;
  }

  const { data, error } = await supabase
    .from('body_measurements')
    .insert({
      user_id: userId,
      measured_at: finalMeasuredAt,
      weight_kg: weightKg,
      body_fat_pct: bodyFatPct,
      muscle_kg: muscleKg,
      raw_input: measurementText,
    })
    .select();

  if (error) throw new Error('body_measurements insert failed: ' + error.message);
  return (data?.[0] as MeasurementEntry) ?? null;
}

// The toast line, matching foodSaveSummary / activitySaveSummary: label plus
// the headline number, short enough to verify at a glance.
export function measurementSaveSummary(entry: MeasurementEntry): string {
  const parts: string[] = [];
  if (entry.weight_kg != null) parts.push(`${Math.round(entry.weight_kg * 10) / 10} kg`);
  if (entry.body_fat_pct != null) parts.push(`${Math.round(entry.body_fat_pct * 10) / 10}% fat`);
  if (entry.muscle_kg != null) parts.push(`${Math.round(entry.muscle_kg * 10) / 10} kg muscle`);
  return `Weigh-in — ${parts.join(' · ')}`;
}
