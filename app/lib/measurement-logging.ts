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

// One personally-tracked metric: a waist, a resting heart rate, a blood
// pressure. Open by design - the spec promises "any personally meaningful
// point, not limited to a preset menu" - so the NAME is free text, normalised
// at log time against what this person already tracks rather than matched
// against a list nobody can finish writing (Part Two, principle 13).
export type ParsedPersonalMetric = {
  name?: string;
  value?: number | null;
  value_secondary?: number | null;
  unit?: string | null;
};

export type PersonalMetricEntry = {
  id: string;
  metric_name: string;
  value: number;
  unit: string | null;
};

type ParsedMeasurement = {
  personal?: ParsedPersonalMetric[] | null;
  weight_kg: number | null;
  weight_lb: number | null;
  weight_stone: number | null;
  weight_stone_lb: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
  detected_date: string | null;
  // Did they NAME the thing they were measuring, or just say a number? Only
  // meaningful on a correction, where a bare number has to be attached to one
  // of three existing readings and guessing wrong rewrites the wrong one.
  field_stated: MeasurementField | null;
};

// The three scale fields, as the person would refer to them.
export type MeasurementField = 'weight' | 'body_fat' | 'muscle';

// A correction whose target could not be worked out. Carries the candidates so
// the question names them rather than asking a vague "which one?".
export type MeasurementAmbiguity = { value: number; candidates: MeasurementField[] };

// The current values of the row a correction is aimed at, so ambiguity can be
// judged against what is actually on it: a number that could be either of two
// readings THIS PERSON HAS is ambiguous; one that could only be a weight is not.
export type CorrectionTargetRow = {
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
};

// Which of the row's populated fields this value could plausibly be.
//
// Plausibility alone is not enough to pick a field and never was: 26.4 is a
// credible body fat percentage AND a credible weight in kg, and on a row that
// has both there is no honest way to choose. The ranges here are the same ones
// the write guard uses, so a value that could not be stored as a field is not
// offered as a candidate for it either.
function candidateFields(value: number, row: CorrectionTargetRow): MeasurementField[] {
  const out: MeasurementField[] = [];
  if (row.weight_kg != null && value >= MIN_WEIGHT_KG && value <= MAX_WEIGHT_KG) out.push('weight');
  if (row.body_fat_pct != null && value >= MIN_BODY_FAT_PCT && value <= MAX_BODY_FAT_PCT) {
    out.push('body_fat');
  }
  if (row.muscle_kg != null && value >= 1 && value <= MAX_WEIGHT_KG) out.push('muscle');
  return out;
}

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
  updateId?: string,
  // The row `updateId` points at, when this is a correction. Supplied so a bare
  // number can be checked against the readings that actually exist on it before
  // anything is written.
  targetRow?: CorrectionTargetRow
  // Returns BOTH destinations, because one message routinely carries both:
  // "55.2 and waist 70" is a scale reading and a tape reading, and making the
  // model pick one bucket would silently drop the other. `ambiguous` is set
  // instead of `reading` when a correction could not be aimed safely - nothing
  // is written in that case, and the caller asks.
): Promise<{
  reading: MeasurementEntry | null;
  personal: PersonalMetricEntry[];
  ambiguous?: MeasurementAmbiguity | null;
}> {
  // The names this person ALREADY tracks, handed to the model so it reuses them.
  // Without this, "my waist", "waist" and "Waist" become three separate metrics
  // and the table grows a row per phrasing - the open-ended equivalent of a
  // misclassification, and invisible until the table looks wrong.
  const { data: knownRows } = await supabase
    .from('personal_metrics')
    .select('metric_name')
    .eq('user_id', userId);
  const known = Array.from(new Set((knownRows ?? []).map((r) => r.metric_name as string)));

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
    'Set field_stated to "weight", "body_fat" or "muscle" ONLY when they actually named which reading they meant ' +
    '(a word like "weight", "body fat", "muscle", or a unit that settles it such as "%"). If they gave a bare ' +
    'number with nothing identifying it - "no, 55.2" - return null. Do NOT infer it from the size of the number: ' +
    'null is the correct and useful answer there, and the app asks them. ' +
    'Respond ONLY with valid JSON, no other text, in this exact format: ' +
    '{"weight_kg": number_or_null, "weight_lb": number_or_null, "weight_stone": number_or_null, ' +
    '"weight_stone_lb": number_or_null, "body_fat_pct": number_or_null, "muscle_kg": number_or_null, ' +
    '"detected_date": iso8601_date_string_or_null, "field_stated": "weight"_or_"body_fat"_or_"muscle"_or_null, ' +
    '"personal": [{"name": string, "value": number, "value_secondary": number_or_null, "unit": string_or_null}]} ' +
    'Put ANY body measurement that is not weight, body fat or muscle into "personal" - a waist, a thigh, a hip, ' +
    'a resting heart rate, a blood pressure, anything they choose to track. Use the unit they said (cm, in, bpm, ' +
    'mmHg) and leave unit null if they gave none. For a paired reading like a blood pressure of 120 over 80, put ' +
    '120 in value and 80 in value_secondary; everything else leaves value_secondary null. ' +
    (known.length > 0
      ? 'This person already tracks these metrics: ' +
        known.map((k) => '"' + k + '"').join(', ') +
        '. If they mean one of those, reuse its name EXACTLY as written above, whatever words they used this time - ' +
        '"my waist", "waist" and "Waist" are all the existing "waist". Only invent a new name for something genuinely new. '
      : 'Name each one in lower case, as plainly as possible ("waist", not "waist circumference"), since these names become the labels they will see. ') +
    'Return an empty array when there are none. ' +
    'Measurement: "' +
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


  let finalMeasuredAtForPersonal = measuredAt || new Date().toISOString();
  if (parsed.detected_date) {
    const timeOnly = new Date(finalMeasuredAtForPersonal).toISOString().slice(11, 19);
    finalMeasuredAtForPersonal = parsed.detected_date + 'T' + timeOnly + 'Z';
  }

  // Personal metrics are written FIRST and independently of the scale fields,
  // because the two halves genuinely stand alone: "waist 70" with no weight in
  // it must still save, and the all-null guard below is about the scale row
  // only. A correction (updateId) targets one specific scale row, so it does
  // not touch these - correcting a personal metric is not yet a thing the
  // correction path knows how to do, and half-doing it would be worse.
  const personal: PersonalMetricEntry[] = [];
  if (!updateId && Array.isArray(parsed.personal)) {
    const rows = parsed.personal
      .map((m) => ({
        user_id: userId,
        measured_at: finalMeasuredAtForPersonal,
        metric_name: String(m?.name ?? '').trim().slice(0, 60),
        value: typeof m?.value === 'number' && isFinite(m.value) ? m.value : null,
        value_secondary:
          typeof m?.value_secondary === 'number' && isFinite(m.value_secondary)
            ? m.value_secondary
            : null,
        unit: typeof m?.unit === 'string' && m.unit.trim() ? m.unit.trim().slice(0, 16) : null,
        raw_input: measurementText,
      }))
      // A metric with no name or no number is not a measurement, it is a
      // misparse. Dropped rather than stored, on the same grounds as the
      // empty-scale-row guard: a nameless row would sit in her table forever.
      .filter((r) => r.metric_name.length > 0 && r.value != null);

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('personal_metrics')
        .insert(rows)
        .select('id, metric_name, value, unit');
      if (error) {
        console.log('personal_metrics insert failed (non-fatal):', error.message);
      } else {
        personal.push(...((data ?? []) as PersonalMetricEntry[]));
      }
    }
  }

  // Nothing usable in the SCALE half. Returns no reading rather than writing an
  // empty row: a row with no numbers would still count as a reading everywhere
  // downstream - breaking a trend chain, and satisfying "they logged today"
  // when they did not. Any personal metrics above still stand.
  if (weightKg == null && bodyFatPct == null && muscleKg == null) {
    return { reading: null, personal };
  }

  // ASK, DON'T ASSUME (2026-08-28). A correction carrying one bare number and
  // no word saying which reading it is cannot be aimed by inference: on a row
  // holding a weight, a body fat and a muscle mass, 26.4 is a credible value
  // for more than one of them, and picking the likeliest silently rewrites a
  // reading the person never mentioned. The same rule the safety and extraction
  // work already follow - a question is cheap, a wrong write to someone's body
  // data is not, and it is wrong invisibly.
  //
  // Sits after the personal-metric write and before any scale write, so an
  // ambiguous scale correction cannot leave a half-applied turn behind.
  //
  // Scoped to corrections on purpose. A FRESH log has no row to be confused
  // with, so a bare number there is an ordinary weigh-in, and asking about it
  // would be the nagging the voice rules exist to prevent.
  if (updateId && targetRow && parsed.field_stated == null) {
    const stated = [weightKg, bodyFatPct, muscleKg].filter((v): v is number => v != null);
    if (stated.length === 1) {
      const candidates = candidateFields(stated[0], targetRow);
      if (candidates.length > 1) {
        return { reading: null, personal, ambiguous: { value: stated[0], candidates } };
      }
    }
  }

  const finalMeasuredAt = finalMeasuredAtForPersonal;

  // A correction replaces the row it is correcting. Otherwise: inserted, never
  // merged over a same-day reading - re-weighing in a day is normal, the
  // history is append-only, and everything downstream already takes the latest
  // reading of a day (see measurements-week.ts). The overwrite/skip prompt in
  // parse-body-measurement is for bulk screenshot imports, where the same
  // reading really can arrive twice; a typed number cannot.
  if (updateId) {
    // ONLY THE FIELDS THE CORRECTION ACTUALLY CARRIED. Writing all three put a
    // null into every field the person did not restate, so "no, 55.2" against a
    // row holding a weight, a body fat and a muscle mass corrected the weight
    // and DELETED the other two - readings they never mentioned and had no
    // reason to think were at risk. Silent, and unrecoverable from the app.
    // A correction is a patch, not a replacement.
    const patch: Record<string, unknown> = {
      measured_at: finalMeasuredAt,
      raw_input: measurementText,
    };
    if (weightKg != null) patch.weight_kg = weightKg;
    if (bodyFatPct != null) patch.body_fat_pct = bodyFatPct;
    if (muscleKg != null) patch.muscle_kg = muscleKg;

    const { data, error } = await supabase
      .from('body_measurements')
      .update(patch)
      .eq('id', updateId)
      // RLS already scopes this, but the explicit filter means a wrong id can
      // never reach another person's row even if a policy is later relaxed.
      .eq('user_id', userId)
      .select();
    if (error) throw new Error('body_measurements update failed: ' + error.message);
    return { reading: (data?.[0] as MeasurementEntry) ?? null, personal };
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
  return { reading: (data?.[0] as MeasurementEntry) ?? null, personal };
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

// The toast line when a message carried only personal metrics - no weight, no
// body fat, no muscle. Same shape as measurementSaveSummary: a label plus the
// numbers, short enough to verify at a glance without reading a sentence.
export function personalSaveSummary(entries: PersonalMetricEntry[]): string {
  const parts = entries.map(
    (e) => `${e.metric_name} ${Math.round(e.value * 10) / 10}${e.unit ? e.unit : ''}`
  );
  return `Logged — ${parts.join(' · ')}`;
}
