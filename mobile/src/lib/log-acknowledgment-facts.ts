import {
  formatWeeklyDelta,
  findWeekAgoReading,
  gapDays,
  weeklyDelta,
  type MeasurementRow,
} from '@/lib/overview-metrics';
import {
  READING_HISTORY_LIMIT,
  ACTIVITY_LOOKBACK_HOURS,
  FOOD_LOOKBACK_HOURS,
  hoursBefore,
  splitReadings,
  toActivityContexts,
  toFoodContexts,
  type RawActivity,
  type RawFood,
  type RawReading,
} from '@/lib/measurement-context';
import { interpretLatestReading } from '@/lib/measurement-interpretation';
import { persistNote } from '@/lib/interpretation-notes';
import { dayLevelProteinNudge, type ProteinSource } from '@/lib/protein-quality';
import { supabase } from '@/lib/supabase';

// Gathering what the photo-log acknowledgment needs (build item 10b, step 4).
//
// Deliberately client-side. Both things that make the acknowledgment worth
// reading - the interpretation layer and the protein-quality nudge - live in
// mobile/src/lib and have no server twin. Reaching for them here reuses the
// built infrastructure exactly, rather than duplicating a reasoning engine
// across the Next/Expo boundary while that question is still open.
//
// The server is handed only the finished facts, so it never re-derives any of
// this and the two can never disagree.

export type BodyAckFacts = {
  // Grounds for any comparative claim; null means none may be made.
  recent: string | null;
  measuredAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleKg: number | null;
  sourceApp: string | null;
  deltaLabel: string | null;
  interpretation: string | null;
};

export type FoodAckFacts = {
  // Grounds for any comparative claim; null means none may be made.
  recent: string | null;
  mealLabel: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  confidence: string | null;
  dayKcal: number | null;
  dayProteinG: number | null;
  kcalTarget: number | null;
  proteinTargetG: number | null;
  proteinNote: string | null;
};

export type ActivityAckFacts = {
  // Grounds for any comparative claim; null means none may be made.
  recent: string | null;
  entries: {
    activityType: string;
    durationMin: number | null;
    kcalBurned: number | null;
    source: string | null;
  }[];
  dailySummary: {
    date: string;
    steps: number | null;
    kcalBurned: number | null;
    activeMinutes: number | null;
    distanceKm: number | null;
    source: string | null;
  } | null;
};

type BodyRow = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
  source_app: string | null;
};

// Up to this many prior readings are shown as grounds for a comparison. Enough
// to see a shape, few enough that the model reads them rather than skims.
const RECENT_LINES = 6;

function recentWeightLines(rows: MeasurementRow[], excludeMeasuredAt: string): string | null {
  const lines = rows
    .filter((r) => r.measured_at !== excludeMeasuredAt && r.weight_kg != null)
    .slice(0, RECENT_LINES)
    .map((r) => {
      const d = new Date(r.measured_at);
      const day = isNaN(d.getTime())
        ? r.measured_at
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const extra = [
        r.body_fat_pct != null ? `${Math.round(r.body_fat_pct * 10) / 10}% fat` : null,
        r.muscle_kg != null ? `${Math.round(r.muscle_kg * 10) / 10} kg muscle` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `${day}: ${Math.round((r.weight_kg as number) * 10) / 10} kg${extra ? ` (${extra})` : ''}`;
    });
  return lines.length ? lines.join('\n') : null;
}

// The interpretation layer's own words for the latest reading, or null when it
// has nothing to say. Silence is a real answer here (see
// measurement-interpretation.ts) and every caller must treat it as one.
//
// Shared by three surfaces so they can never disagree about the same reading:
// the Measurements screen, the photo acknowledgment, and - since 2026-08-26 -
// text weight logging in chat.
export async function loadLatestInterpretation(): Promise<string | null> {
  // RLS scopes every read to the signed-in user.
  const [{ data: readings }, { data: lastPeriod }] = await Promise.all([
    supabase
      .from('body_measurements')
      // id is selected only so the note below can name the row it is about.
      .select('id, measured_at, weight_kg')
      .order('measured_at', { ascending: false })
      .limit(READING_HISTORY_LIMIT),
    supabase
      .from('cycle_events')
      .select('event_date')
      .eq('event_type', 'period_start')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const split = splitReadings((readings ?? []) as RawReading[]);
  if (!split) return null;

  // Both windows are anchored to the reading, so they can only be queried once
  // it is known.
  const [{ data: activities }, { data: foods }] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('happened_at, eccentric_load')
      .gte('happened_at', hoursBefore(split.latest.measured_at, ACTIVITY_LOOKBACK_HOURS))
      .lte('happened_at', split.latest.measured_at),
    supabase
      .from('food_logs')
      .select('happened_at, sodium_mg')
      .gte('happened_at', hoursBefore(split.latest.measured_at, FOOD_LOOKBACK_HOURS))
      .lte('happened_at', split.latest.measured_at),
  ]);

  const message =
    interpretLatestReading({
      latest: { weightKg: split.latest.weight_kg, measuredAt: split.latest.measured_at },
      priorWeights: split.priorWeights,
      priorWeightMeasuredAts: split.priorWeightMeasuredAts,
      lastPeriodStart: lastPeriod?.event_date ?? null,
      recentActivities: toActivityContexts((activities ?? []) as RawActivity[]),
      priorMeasuredAts: split.priorMeasuredAts,
      recentFoods: toFoodContexts((foods ?? []) as RawFood[]),
    })?.message ?? null;

  // The point-in-time record (build item 29). This is the right write point
  // precisely BECAUSE it is not a log-time hook: it fires the first time a
  // reading is actually interpreted for someone, on whichever of the three
  // surfaces got there first, and the store's unique constraint discards every
  // later write for the same reading. So the note is the sentence the person was
  // genuinely shown, not one composed for the database's benefit.
  //
  // Awaited but never allowed to change the return value, and it does not throw.
  // Nothing reads these yet - the display surface is the discuss-card, item 30
  // slice 4 - so today they simply accumulate and appear in the data export.
  // That is expected, not an oversight.
  //
  // A silence is not stored. interpretLatestReading returning null means there
  // was nothing worth saying, and recording "nothing was said" as a note would
  // make an empty row indistinguishable from an unvisited reading.
  if (message && split.latest.id) {
    await persistNote('body_measurement', split.latest.id, message);
  }

  return message;
}

export async function bodyAckFacts(saved: BodyRow): Promise<BodyAckFacts> {
  // RLS scopes every read to the signed-in user. The cycle read that used to
  // sit here went with the interpretation logic into loadLatestInterpretation;
  // these rows are only for the delta and the recent-history block.
  const { data: history } = await supabase
    .from('body_measurements')
    .select('measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
    .order('measured_at', { ascending: false })
    .limit(READING_HISTORY_LIMIT);

  const rows = (history ?? []) as MeasurementRow[];

  // The same gap-aware delta the Overview shows, so the two surfaces cannot
  // caption the same comparison differently.
  const ref = findWeekAgoReading(rows, saved.measured_at);
  const deltaLabel = ref
    ? formatWeeklyDelta(
        weeklyDelta(saved.weight_kg, ref.weight_kg),
        gapDays(saved.measured_at, ref.measured_at)
      )
    : null;

  const interpretation = await loadLatestInterpretation();

  // The recent readings, as plain lines. Built from history already fetched
  // above, so it costs nothing extra - and it is the only thing that lets the
  // acknowledgment say how today compares without inventing it.
  const recent = recentWeightLines(rows, saved.measured_at);

  return {
    recent,
    measuredAt: saved.measured_at,
    weightKg: saved.weight_kg,
    bodyFatPct: saved.body_fat_pct,
    muscleKg: saved.muscle_kg,
    sourceApp: saved.source_app,
    deltaLabel,
    interpretation,
  };
}

type FoodRow = {
  meal_label: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: string | null;
};

export async function foodAckFacts(saved: FoodRow): Promise<FoodAckFacts> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: today } = await supabase
    .from('food_logs')
    .select('kcal, protein_g, protein_source')
    .gte('happened_at', startOfDay.toISOString());

  const rows = (today ?? []) as {
    kcal: number | null;
    protein_g: number | null;
    protein_source: string | null;
  }[];

  return {
    // No history block for food yet: a useful one is a few days of totals by
    // meal, which is a real query rather than a field. Null means the
    // acknowledgment describes the meal without claiming how it compares.
    recent: null,
    mealLabel: saved.meal_label ?? 'Food',
    kcal: saved.kcal,
    proteinG: saved.protein_g,
    carbsG: saved.carbs_g,
    fatG: saved.fat_g,
    confidence: saved.confidence,
    dayKcal: rows.reduce((s, f) => s + (f.kcal ?? 0), 0),
    dayProteinG: rows.reduce((s, f) => s + (f.protein_g ?? 0), 0),
    // Targets are deliberately absent for now. They compose resolveTDEE ->
    // calculateCalorieTarget plus the profile read, which is the Overview's
    // whole chain; pulling it in here belongs with that refactor rather than
    // bolted on. The day totals still stand on their own without a target.
    kcalTarget: null,
    proteinTargetG: null,
    // Item 12's day-level nudge, reused rather than re-derived. The second
    // argument is the base protein target, which buffers the nudge's own
    // suggestion; null here for the same reason the targets above are null, and
    // the nudge degrades to its unbuffered wording rather than failing.
    proteinNote:
      dayLevelProteinNudge(
        rows.map((f) => ({
          source: (f.protein_source as ProteinSource | null) ?? null,
          grams: f.protein_g ?? 0,
        })),
        null
      )?.message ?? null,
  };
}

type ActivityRow = {
  activity_type: string | null;
  duration_min: number | null;
  kcal_burned: number | null;
  source: string | null;
};

type DailySummaryRow = {
  date: string;
  steps: number | null;
  kcal_burned: number | null;
  active_minutes: number | null;
  distance_km: number | null;
  source: string | null;
};

export function activityAckFacts(
  saved: ActivityRow[],
  dailySummary?: DailySummaryRow | null
): ActivityAckFacts {
  return {
    // As for food: no grounds for a comparison, so none may be claimed.
    recent: null,
    entries: saved.map((e) => ({
      activityType: e.activity_type ?? 'Activity',
      durationMin: e.duration_min,
      kcalBurned: e.kcal_burned,
      source: e.source,
    })),
    dailySummary: dailySummary
      ? {
          date: dailySummary.date,
          steps: dailySummary.steps,
          kcalBurned: dailySummary.kcal_burned,
          activeMinutes: dailySummary.active_minutes,
          distanceKm: dailySummary.distance_km,
          source: dailySummary.source,
        }
      : null,
  };
}
