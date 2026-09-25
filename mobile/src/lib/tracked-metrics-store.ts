import { currentUserId } from '@/lib/current-user';
import { readTrackedMetrics, type TrackedMetric } from '@/lib/tracked-metrics';
import { supabase } from '@/lib/supabase';

// READING AND WRITING HER LIST OF MEASUREMENTS.
//
// SEPARATED FROM THE RULES, for the same reason log-layout.ts is separated
// from log-layout-rules.ts, and the note there says it best: the rules are
// "the part that can be wrong in a way nobody notices". They decide which
// numbers about somebody's own body appear on a screen, so they get a probe -
// and a probe cannot import a file that reaches for Supabase and a `@/` alias
// Node knows nothing about.
//
// It stopped being theoretical the moment these two functions were written
// into tracked-metrics.ts: probe-tracked-metrics.mjs died on the import, and
// the twenty-odd cases it holds would have stopped running with nothing to say
// so beyond a stack trace.

export async function loadTrackedMetrics(): Promise<TrackedMetric[] | null> {
  try {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data } = await supabase
      .from('user_profile')
      .select('tracked_metrics')
      .eq('user_id', userId)
      .maybeSingle();
    return readTrackedMetrics((data as { tracked_metrics?: unknown } | null)?.tracked_metrics);
  } catch {
    // Her own arrangement failing to load must never cost her the screen: the
    // derived list is a perfectly good one.
    return null;
  }
}

/** Returns false when nothing was written, so a caller can say so. */
export async function saveTrackedMetrics(list: TrackedMetric[]): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase
      .from('user_profile')
      .upsert({ user_id: userId, tracked_metrics: list }, { onConflict: 'user_id' });
    if (error) {
      console.log('TRACKED METRICS: could not save -', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
