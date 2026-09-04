import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseForRequest } from '../../lib/supabase';
import {
  coerceEccentricLoad,
  coerceIntensity,
  logActivityFromText,
  type ParsedActivity,
} from '../../lib/activity-logging';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// A number or null, never NaN and never a string that looks numeric. The daily
// summary columns are all nullable on purpose - a screen that does not show
// distance must store no distance, not a zero that reads as "walked nowhere".
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

  const { activityText, happenedAt, images } = await request.json();

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
  //
  // THE MODEL NOW DECLARES `kind` RATHER THAN IMPLYING IT. This prompt always
  // told the two screens apart correctly; what it then did was package a whole
  // day as one activity object, and the only trace of which screen it had been
  // was a free-text `source` string. Branching on prose the model writes is a
  // guess. An enum it must choose from is an answer.
  const textInstruction =
    'This image is a screenshot from a fitness tracking app (e.g. Samsung Health). It could be either: (a) a DAILY SUMMARY screen showing total steps, active time, activity calories, total burnt calories, and distance for a whole day, or (b) a SPECIFIC WORKOUT screen showing one activity (e.g. a run) with details like distance, pace, duration, cadence. Identify which type this is. A DAILY SUMMARY IS NOT AN ACTIVITY. It is a whole day of incidental movement added up, not something the person did as a session, and it must never be described as one. If it is a daily summary, set kind to "daily_summary" and fill the "summary" object: steps, kcal_burned = the total burnt calories figure shown, active_minutes = the active time shown, distance_km = the distance shown converting miles to km if needed, and date as YYYY-MM-DD only if the screen actually states which day it is (null otherwise, and never guess). Use null for any figure the screen does not show, and leave "activities" as an empty array. If it is a specific workout, set kind to "workout", leave "summary" null, and respond with ONE activity object in "activities": activity_type = the activity name (e.g. "Running"), duration_min = its duration, kcal_burned = its calorie figure, notes = distance/pace/cadence/incline as a short readable summary. ' + (activityText ? 'The person also added this note: "' + activityText + '". ' : '') + 'Where the screen makes it evident, also set "intensity" ("light" | "moderate" | "intense") and "eccentric_load" ("none" | "low" | "moderate" | "high", meaning the eccentric muscle stress that drives next-day soreness, e.g. higher for hilly/downhill running); use null for either when the screen does not make it clear. Respond ONLY with valid JSON, no other text, in this exact format: {"kind": "daily_summary" | "workout", "summary": {"date": string_or_null, "steps": number_or_null, "kcal_burned": number_or_null, "active_minutes": number_or_null, "distance_km": number_or_null} | null, "activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "notes": string_or_null, "intensity": "light" | "moderate" | "intense" | null, "eccentric_load": "none" | "low" | "moderate" | "high" | null}], "source": "Samsung daily summary" or "Samsung workout screenshot"}'

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
  } catch {
    console.log('PARSE-ACTIVITY JSON PARSE ERROR:', cleanedText);
    return NextResponse.json({ error: 'Something went wrong reading that entry' }, { status: 500 });
  }

  // A DAILY SUMMARY LEAVES HERE. It never reaches activity_logs.
  //
  // Belt and braces on the branch: the declared `kind` is the answer, but an
  // older or drifting response that only says "Daily Summary" in activity_type,
  // or "daily summary" in source, is still a daily summary and is still not a
  // session. Any of the three is enough to divert it, because the cost of
  // reading a real workout as a summary (one row in the wrong table) is far
  // smaller than the cost of the reverse, which is the bug being fixed.
  const looksLikeSummary =
    parsed.kind === 'daily_summary' ||
    (typeof parsed.source === 'string' && /daily summary/i.test(parsed.source)) ||
    (Array.isArray(parsed.activities) &&
      parsed.activities.some(
        (a: ParsedActivity) => typeof a?.activity_type === 'string' && /daily summary/i.test(a.activity_type)
      ));

  if (looksLikeSummary) {
    const summary = (parsed.summary ?? {}) as Record<string, unknown>;
    // Fall back to the activity object's fields when the model answered in the
    // old shape - the figures are the same numbers, just in the wrong envelope.
    const legacy = (Array.isArray(parsed.activities) ? parsed.activities[0] : null) as ParsedActivity | null;

    const summaryDate =
      typeof summary.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(summary.date)
        ? summary.date
        : new Date(happenedAt || new Date().toISOString()).toISOString().slice(0, 10);

    const row = {
      user_id: user.id,
      date: summaryDate,
      steps: num(summary.steps),
      kcal_burned: num(summary.kcal_burned) ?? num(legacy?.kcal_burned),
      active_minutes: num(summary.active_minutes) ?? num(legacy?.duration_min),
      distance_km: num(summary.distance_km),
      source: typeof parsed.source === 'string' ? parsed.source : 'Samsung daily summary',
    };

    // Upsert, not insert. The figures on that screen climb all day, so
    // photographing it twice is ordinary behaviour and must correct the day
    // rather than stack a second copy of it.
    const { data: savedSummary, error: summaryError } = await supabase
      .from('daily_activity_summaries')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (summaryError) {
      console.log('PARSE-ACTIVITY DAILY SUMMARY ERROR:', summaryError.message);
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    // `entries` stays present and empty so existing callers keep their shape;
    // `dailySummary` is what the acknowledgment reads. Nothing was logged as an
    // activity, and the response says so plainly rather than by omission.
    return NextResponse.json({ entries: [], dailySummary: savedSummary });
  }

let finalHappenedAt = happenedAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(happenedAt || new Date().toISOString()).toISOString().slice(11, 19);
    finalHappenedAt = parsed.detected_date + 'T' + timeOnly;
  }

  const rowsToInsert = parsed.activities.map((activity: ParsedActivity) => ({
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