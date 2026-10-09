import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordModelUsage } from './usage-record';

import { coverageFor } from './activity-weights';
import {
  REPEAT_WINDOW_MS,
  sameNumber,
  sameWords,
  splitAlreadyWritten,
} from './written-once';

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
  distance_km?: number;
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

// THE SAME ACTIVITY, WRITTEN ONCE (9 October 2026).
//
// Ruth, that morning: "run was logged fine, but yoga 60mins was logged 5
// times." She said it once - "It was about an hour" - and five identical rows
// landed between 09:41:40 and 09:42:16.
//
// WHAT ACTUALLY HAPPENED, from model_usage. That turn took 14.4 seconds to
// answer, and ElevenLabs stopped waiting and sent it again. Five separate
// turns ran, each with its own turn id, each classifying the same words the
// same way, each writing the row. The retries took 1.2 seconds apiece because
// the first one had warmed the cache - so being slow once cost her five rows.
//
// WHY THE GUARD WE HAD COULD NOT CATCH IT, and this is the part worth keeping.
// Two guards already existed and both were built for a different shape of the
// same accident:
//   - voice-supersede's `continues()` requires the new text to be LONGER
//     ("...and blackcurrant jam"). An identical repeat is excluded on its
//     second line, by design. It also only ever covered food.
//   - the adapter's turn check asks whether she HEARD the last answer. She
//     had. So every retry read as a fresh turn.
// Both were reasoning about why the words arrived twice. This one does not
// care why. Identical words, same activity, same length, minutes apart, is one
// activity - whether it came from a retry, a double tap, or a lost connection.
//
// THE WINDOW IS NOT A DAY. Two genuine thirty-minute runs in one day get
// described separately and both belong in the table; two arriving inside ten
// minutes with byte-identical wording do not.
export const ACTIVITY_REPEAT_WINDOW_MS = REPEAT_WINDOW_MS;

/**
 * What makes two activity rows the same event. Her exact words, the activity
 * the parse found, and how long it was - nothing time-based, because the
 * window is applied separately and a key with a clock in it quietly stops
 * matching across the boundary.
 *
 * Pure, so scripts/check-activity-once.mjs can prove it separates things that
 * differ as well as joining things that do not.
 */
export type RepeatShape = {
  raw_input?: string | null;
  activity_type?: string | null;
  duration_min?: number | null;
};

export function activityRepeatKey(row: RepeatShape): string {
  return [
    sameWords(row.raw_input),
    sameWords(row.activity_type),
    sameNumber(row.duration_min),
  ].join('\u0000');
}

/**
 * Split what we are about to write into what is new and what is already there.
 *
 * Pure and separate from the insert on purpose: this is the decision, and
 * scripts/check-activity-once.mjs runs it against the five real yoga rows from
 * 9 October to prove one survives - a thing that cannot be proved by reading
 * the insert and seeing a guard above it.
 *
 * Row by row, not all or nothing: "an hour of yoga then a 20 minute walk" sent
 * twice, where only the walk is new, must still log the walk.
 */
export function splitAlreadyLogged<T extends RepeatShape>(
  candidates: T[],
  recent: ActivityEntry[]
): { fresh: T[]; alreadyThere: ActivityEntry[] } {
  return splitAlreadyWritten(candidates, recent, (row) =>
    activityRepeatKey(row as RepeatShape)
  );
}

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
    '. If they mention a relative date (e.g. "yesterday", "on Monday", "two days ago", "this morning"), calculate the actual date they mean and return it as detected_date in ISO 8601 format (just the date, e.g. "2026-07-30"). If no date is mentioned, return null for detected_date and the current time will be used instead. If they describe MULTIPLE distinct activities (e.g. "1.5 hours ballet then 1 hour yoga"), split them into SEPARATE entries in the activities array, each with its own duration and calorie estimate - do not combine them into one entry. DURATION IS NOT TO BE GUESSED: return duration_min as a number ONLY when the text actually says how long, or says something that fixes it (a distance with a pace, "a 5k in 28 minutes", "an hour of yoga"). If the text does not tell you, return null for duration_min and null for kcal_burned rather than a typical figure - a made-up 30 minutes becomes a made-up calorie burn, and the person is then shown a number about their day that nobody measured. Estimate calories burned from the activity type and the REAL duration, using any intensity clues mentioned (e.g. "moderate", "intense", "easy"). Return distance_km ONLY when the text states a distance, converting miles to kilometres if that is the unit given; return null when no distance is mentioned, and never infer one from a duration. A distance is not something to estimate: a person who ran for 30 minutes did not necessarily cover 5 km, and a number nobody measured is worse than no number. Also classify two things per activity from the description. "intensity": how hard it was, either "light" (gentle/easy, e.g. a stroll or restorative yoga), "moderate", or "intense" (vigorous, near-max, "to failure"), or null if the description gives no cue. "eccentric_load": the eccentric (lengthening-under-load) muscle stress that drives next-day soreness: "high" for downhill or hilly running, heavy slow lowering, plyometrics, or long eccentric-heavy sessions; "moderate" for ordinary resistance training or hilly hikes; "low" for mostly-concentric or light resistance; "none" for steady cycling, swimming, or easy flat walking, or null if unclear. Respond ONLY with valid JSON, no other text, in this exact format: {"activities": [{"activity_type": string, "duration_min": number, "kcal_burned": number, "distance_km": number_or_null, "notes": string_or_null, "intensity": "light" | "moderate" | "intense" | null, "eccentric_load": "none" | "low" | "moderate" | "high" | null}], "source": "manual text", "detected_date": iso8601_date_string_or_null} Activity description: "' +
    activityText +
    '"';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: instruction }],
  });

  // COUNTED. The Haiku parse is about an eighth of a logging turn, and a cost
  // table that leaves it out is wrong in the same direction every time.
  recordModelUsage({
    userId,
    call: 'extraction',
    model: 'claude-haiku-4-5-20251001',
    usage: message.usage,
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  let finalHappenedAt = happenedAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(happenedAt || new Date().toISOString()).toISOString().slice(11, 19);
    finalHappenedAt = parsed.detected_date + 'T' + timeOnly;
  }

  // The prompt in ask-selodia is supposed to withhold logIntent 'activity'
  // until a duration is known, and the parse prompt above is supposed to return
  // null rather than invent one. This is the third check, because the first two
  // are both model behaviour and this one is not: a row with no duration is a
  // calorie figure with nothing underneath it, and it is better to log nothing
  // than to log that. Silently dropping is right here - the caller reports what
  // landed, and an empty result reads as "not logged" all the way up.
  //
  // A REST DAY IS THE ONE THING WITH NO DURATION TO WITHHOLD (22 September
  // 2026). The rule above exists because a calorie figure cannot be built on a
  // guessed length - and a rest day burns nothing to guess at. Without this
  // exception, "rest day today" was silently dropped, which is why recovery
  // could never be earned by saying so.
  // String.raw, because a backslash written through a script has landed in a
  // regex as a literal backspace five separate times on this project today.
  // Without the word boundaries, "restaurant" would count as a rest day.
  const isRest = (a: ParsedActivity) =>
    new RegExp(String.raw`\brest\b`, 'i').test(String(a.activity_type ?? ''));

  const loggable = (parsed.activities as ParsedActivity[]).filter(
    (a) => isRest(a) || (typeof a.duration_min === 'number' && a.duration_min > 0)
  );
  if (loggable.length === 0) return [];

  let rowsToInsert = loggable.map((activity: ParsedActivity) => {
    // Health Flower coverage, resolved once here rather than on every render of
    // the Overview. Null when the activity is not in the weighting table, and
    // the six columns stay null together: a partially classified row would be
    // worse than an unclassified one, because the flower would count the
    // dimensions it found and silently treat the rest as zero.
    const cover = coverageFor(activity.activity_type);
    return {
    user_id: userId,
    happened_at: finalHappenedAt,
    activity_type: activity.activity_type,
    duration_min: activity.duration_min,
    kcal_burned: activity.kcal_burned,
    // Null rather than 0 when absent. A yoga session did not cover zero
    // kilometres, it has no distance at all, and the column is nullable so the
    // difference survives into the table.
    distance_km: typeof activity.distance_km === 'number' && activity.distance_km > 0
      ? activity.distance_km
      : null,
    source: parsed.source,
    raw_input: activityText,
    notes: activity.notes,
    intensity: coerceIntensity(activity.intensity),
    eccentric_load: coerceEccentricLoad(activity.eccentric_load),
    cover_strength: cover?.strength ?? null,
    cover_cardio: cover?.cardio ?? null,
    cover_flexibility: cover?.flexibility ?? null,
    cover_balance: cover?.balance ?? null,
    cover_bone: cover?.bone ?? null,
    cover_recovery: cover?.recovery ?? null,
    };
  });

  // ALREADY WRITTEN? See ACTIVITY_REPEAT_WINDOW_MS. Read back what this person
  // logged in the window and drop anything that matches, row by row - so a
  // sentence naming two activities where only one is a repeat still logs the
  // other.
  //
  // THE ROW THAT ALREADY EXISTS IS RETURNED IN ITS PLACE, not nothing. The
  // caller turns this list into what it tells her, and a retry that answered
  // "I did not log that" would be both false and frightening: the yoga IS
  // logged. Returning [] is reserved for the duration gate above, where
  // genuinely nothing landed.
  //
  // FAIL OPEN on a failed read, matching the adapter's own guard: a duplicate
  // row is a smaller harm than refusing to log because a check could not run.
  let alreadyThere: ActivityEntry[] = [];
  try {
    const { data: recent } = await supabase
      .from('activity_logs')
      .select('id, activity_type, duration_min, kcal_burned, notes, source, raw_input')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - ACTIVITY_REPEAT_WINDOW_MS).toISOString());
    const split = splitAlreadyLogged(rowsToInsert, (recent ?? []) as unknown as ActivityEntry[]);
    alreadyThere = split.alreadyThere;
    if (alreadyThere.length > 0) {
      console.log(
        'ACTIVITY ALREADY LOGGED, not writing again:',
        JSON.stringify(alreadyThere.map((r) => ({ activity: r.activity_type, minutes: r.duration_min })))
      );
    }
    if (split.fresh.length === 0) return alreadyThere;
    rowsToInsert = split.fresh;
  } catch (err) {
    console.log(
      'ACTIVITY repeat check failed, writing anyway -',
      err instanceof Error ? err.message : err
    );
    alreadyThere = [];
  }

  const { data, error } = await supabase.from('activity_logs').insert(rowsToInsert).select();
  if (error) throw new Error('activity_logs insert failed: ' + error.message);
  return [...alreadyThere, ...(data as ActivityEntry[])];
}
