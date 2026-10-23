import { sleepObservation, type InsightDay, type InsightNight } from '@/lib/sleep-insight';
import type { SleepNight } from '@/lib/sleep';
import { supabase } from '@/lib/supabase';

// THE DATA HALF OF THE OBSERVATION. The rules live in sleep-insight.ts, which
// touches nothing and can therefore be checked; this reads the rows and hands
// them over. Same split as sleep-night.ts and sleep-sync.ts, for the same
// reason: a rule that cannot be tested is a rule nobody can rely on.

/** Which days had movement logged before noon, over the last few weeks. */
export async function loadMorningDays(days = 60): Promise<InsightDay[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('activity_logs')
    .select('happened_at, duration_min')
    .gte('happened_at', since.toISOString());
  if (error) {
    console.log('sleep observation: activity read failed -', error.message);
    return [];
  }

  const byDate = new Map<string, InsightDay>();
  for (const row of (data ?? []) as { happened_at: string; duration_min: number | null }[]) {
    const at = new Date(row.happened_at);
    if (Number.isNaN(at.getTime())) continue;
    const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    const had = byDate.get(date) ?? { date, activeMinutes: 0, morning: false };
    had.activeMinutes += row.duration_min ?? 0;
    // BEFORE NOON. A walk at 11am is a morning walk; one at 2pm is not, and
    // blurring them would make the comparison mean nothing.
    if (at.getHours() < 12) had.morning = true;
    byDate.set(date, had);
  }
  return [...byDate.values()];
}

/** The sentence for this screen, or null - which is the usual answer. */
export function observationFor(nights: SleepNight[], days: InsightDay[]): string | null {
  const shaped: InsightNight[] = nights.map((n) => ({
    nightOf: n.night_of,
    minutes: n.duration_min,
  }));
  return sleepObservation(shaped, days);
}
