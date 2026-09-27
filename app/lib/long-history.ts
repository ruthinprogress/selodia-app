import type { SupabaseClient } from '@supabase/supabase-js';

// THE RECORD BEYOND THE LAST SEVEN DAYS (Ruth, 26 September 2026).
//
// "I asked for an estimate of my actual TDEE using my logged data. It said it
// only had one weight reading (24 Sept). The Measurements screen shows weeks of
// history, so the data exists; the chat just isn't getting it."
//
// It was not getting it because EVERY block in the turn prompt is bounded by
// one context window - seven days typed, three spoken - which is right for a
// food log and wrong for a body. A weight trend is the one thing in this app
// that is meaningless at seven days and obvious at twelve weeks, and a TDEE
// estimate is arithmetic on exactly that: what the scale did over weeks set
// against what was eaten over the same weeks.
//
// SUMMARISED, NOT DUMPED. Six months of raw readings would be thousands of
// tokens on every turn to answer a question asked once a month. Weekly figures
// carry the trend at a fraction of the size, and a trend is what the question
// is actually about - the day-to-day noise is the part a person should be
// taught to ignore.
//
// AND IT SAYS WHAT IT CAN SEE. Her second point is the more important one:
// "if data genuinely is missing, the chat should say what it can see and over
// what dates, not state that there's only one reading." So this block always
// names its window and its counts, even when they are zero, which gives the
// model something true to say instead of an inference from an empty variable.

/** How far back this reaches. Long enough for a body-composition trend. */
const DAYS = 180;

type Row = Record<string, unknown>;

function iso(d: Date): string {
  return d.toISOString();
}

function weekKey(when: string): string {
  const d = new Date(when);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function pretty(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** How far back stays weekly. Older than this is summarised by month. */
const WEEKLY_WEEKS = 8;

/**
 * One line per period: weekly while it is recent, monthly once it is not.
 *
 * WHY IT IS NOT ALL WEEKLY (27 September 2026). It was, and 26 weeks of weekly
 * lines across every metric she tracks ran to a few thousand tokens - in the
 * PERSON'S half of the prompt, which sits after the cache breakpoint and is
 * therefore re-read in full on every single turn. Spoken turns went from about
 * 3.2 seconds on Wednesday to between 3.8 and 5.9 by Sunday, and this block is
 * one of the two things that changed.
 *
 * The information lost is real but small: at four months out, what a body was
 * doing in one particular week is not the question anybody asks. The question
 * is the shape of the trend, and a monthly figure carries that at a fifth of
 * the size. Recent weeks stay weekly because that IS where the question lives.
 */
function byPeriod(rows: Row[], when: string, field: string, dp: number): string[] {
  const weeklyFrom = Date.now() - WEEKLY_WEEKS * 7 * 86_400_000;
  const buckets = new Map<string, { values: number[]; monthly: boolean }>();

  for (const r of rows) {
    const v = r[field];
    const t = r[when];
    if (typeof v !== 'number' || !isFinite(v) || typeof t !== 'string') continue;
    const monthly = Date.parse(t) < weeklyFrom;
    const k = monthly ? t.slice(0, 7) : weekKey(t);
    const bucket = buckets.get(k) ?? { values: [], monthly };
    bucket.values.push(v);
    buckets.set(k, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, b]) => {
      const label = b.monthly ? monthName(k) : `w/c ${pretty(k)}`;
      const n = b.values.length;
      return `  ${label}: ${mean(b.values).toFixed(dp)} (${n} ${n === 1 ? 'reading' : 'readings'})`;
    });
}

function monthName(key: string): string {
  return new Date(key + '-01T00:00:00Z').toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function span(rows: Row[], when: string): string {
  const days = rows
    .map((r) => r[when])
    .filter((t): t is string => typeof t === 'string')
    .sort();
  if (days.length === 0) return 'nothing recorded';
  const first = pretty(days[0].slice(0, 10));
  const last = pretty(days[days.length - 1].slice(0, 10));
  return first === last ? `one day, ${first}` : `${first} to ${last}`;
}

/**
 * A compact history of the last six months, for questions the seven-day window
 * cannot answer. Returns a prompt block, or null when the reads fail - a
 * missing block is better than a wrong one.
 */
export async function buildLongHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const from = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  try {
    const [scale, personal, food] = await Promise.all([
      supabase
        .from('body_measurements')
        .select('measured_at, weight_kg, body_fat_pct, muscle_kg')
        .eq('user_id', userId)
        .gte('measured_at', iso(from))
        .order('measured_at', { ascending: true }),
      supabase
        .from('personal_metrics')
        .select('measured_at, metric_name, value, unit')
        .eq('user_id', userId)
        .gte('measured_at', iso(from))
        .order('measured_at', { ascending: true }),
      supabase
        .from('food_logs')
        .select('happened_at, kcal')
        .eq('user_id', userId)
        .gte('happened_at', iso(from))
        .order('happened_at', { ascending: true }),
    ]);

    const scaleRows = (scale.data ?? []) as Row[];
    const personalRows = (personal.data ?? []) as Row[];
    const foodRows = (food.data ?? []) as Row[];

    const lines: string[] = [];

    lines.push(
      `THE LONGER RECORD - the last ${DAYS} days, summarised by week for the last two months and by month before that. The blocks above cover only the last few days; this is the rest of what is stored. When they ask anything about a trend, a change over time, or an estimate that needs weeks of data - a TDEE, a rate of loss, whether something is actually moving - THIS is the data to use, and you must not say you have only one reading without reading it first. If a figure they ask for genuinely is not here, say what you CAN see and over what dates rather than guessing or refusing flatly.`
    );

    // Weight, body fat, muscle.
    lines.push('');
    lines.push(`Scale readings: ${scaleRows.length} in total, ${span(scaleRows, 'measured_at')}.`);
    for (const [field, label, dp] of [
      ['weight_kg', 'Weight (kg)', 1],
      ['body_fat_pct', 'Body fat (%)', 1],
      ['muscle_kg', 'Muscle (kg)', 1],
    ] as const) {
      const w = byPeriod(scaleRows, 'measured_at', field, dp);
      if (w.length > 0) {
        lines.push(`${label}:`);
        lines.push(...w);
      }
    }

    // Everything measured with a tape or a cuff, one section per metric.
    const names = Array.from(
      new Set(personalRows.map((r) => String(r.metric_name ?? '')).filter(Boolean))
    );
    if (names.length > 0) {
      lines.push('');
      lines.push(
        `Other measurements they track: ${names.join(', ')}. ${personalRows.length} readings, ${span(personalRows, 'measured_at')}.`
      );
      for (const name of names) {
        const mine = personalRows.filter((r) => r.metric_name === name);
        const unit = mine.map((r) => r.unit).find((u) => typeof u === 'string' && u) ?? '';
        const w = byPeriod(mine, 'measured_at', 'value', 1);
        if (w.length > 0) {
          lines.push(`${name}${unit ? ` (${unit})` : ''}:`);
          lines.push(...w);
        }
      }
    }

    // Food, as a daily average per week. A TDEE estimate needs both halves.
    lines.push('');
    if (foodRows.length === 0) {
      lines.push('Food: nothing logged in this period.');
    } else {
      const byDay = new Map<string, number>();
      for (const r of foodRows) {
        const t = r.happened_at;
        const k = r.kcal;
        if (typeof t !== 'string' || typeof k !== 'number' || !isFinite(k)) continue;
        const day = t.slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + k);
      }
      const dayRows = [...byDay.entries()].map(([day, kcal]) => ({ day, kcal }));
      lines.push(
        `Food: ${dayRows.length} days with anything logged, ${span(foodRows, 'happened_at')}. Weekly average of the DAILY total, counting only days that have something on them - a week with two days logged is two days of data, not a week of low eating, and must never be read as one:`
      );
      lines.push(...byPeriod(dayRows.map((d) => ({ day: d.day + 'T00:00:00Z', kcal: d.kcal })), 'day', 'kcal', 0));
    }

    return lines.join('\n');
  } catch {
    return null;
  }
}
