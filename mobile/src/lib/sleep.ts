import { currentUserId } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';

// SLEEP, ON THE PHONE (2026-09-20). The server parses what she says in chat
// (app/lib/sleep-logging.ts); this is the tapped version, where the fields are
// already separate and there is nothing to parse.
//
// One row per night, and saving a night again fills in what it adds rather than
// replacing what was there - the same rule the chat path follows, so the two
// cannot disagree.

export type SleepQuality = 'poor' | 'broken' | 'ok' | 'good';

export type SleepNight = {
  id: string;
  night_of: string;
  duration_min: number | null;
  quality: SleepQuality | null;
  awakenings: number | null;
};

export const QUALITY_LABEL: Record<SleepQuality, string> = {
  poor: 'Rough',
  broken: 'Broken',
  ok: 'OK',
  good: 'Good',
};

/** The night that has just ended, as a date: the evening it began. */
export function lastNight(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "7h 30m", or null when no hours were given - never a guess. */
export function formatDuration(minutes: number | null): string | null {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The nights she has described, newest first. */
export async function loadNights(limit = 14): Promise<SleepNight[]> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('id, night_of, duration_min, quality, awakenings')
    .order('night_of', { ascending: false })
    .limit(limit);
  if (error) {
    console.log('sleep read failed:', error.message);
    return [];
  }
  return (data ?? []) as SleepNight[];
}

/**
 * Save a night. Only the fields given are written: a second visit that adds
 * "and I woke twice" must not blank the hours recorded this morning.
 */
export async function saveNight(night: {
  nightOf: string;
  durationMin?: number | null;
  quality?: SleepQuality | null;
  awakenings?: number | null;
}): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;

  const { data: existing } = await supabase
    .from('sleep_logs')
    .select('duration_min, quality, awakenings')
    .eq('night_of', night.nightOf)
    .maybeSingle();

  const { error } = await supabase.from('sleep_logs').upsert(
    {
      user_id: userId,
      night_of: night.nightOf,
      duration_min: night.durationMin ?? existing?.duration_min ?? null,
      quality: night.quality ?? existing?.quality ?? null,
      awakenings: night.awakenings ?? existing?.awakenings ?? null,
      source: 'log',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,night_of' }
  );
  if (error) console.log('sleep save failed:', error.message);
  return !error;
}
