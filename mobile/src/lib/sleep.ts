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
  /** What put the row there. 'phone health platform' means measured. */
  source?: string | null;
  went_to_bed?: string | null;
  woke_at?: string | null;
};

export const QUALITY_LABEL: Record<SleepQuality, string> = {
  poor: 'Poor',
  broken: 'Broken',
  ok: 'OK',
  good: 'Good',
};

// HOW LONG, AS A BAND, BECAUSE THAT IS WHAT SHE ACTUALLY KNOWS.
//
// Ruth's artwork, 23 October 2026, replaced the exact chips - 4h 5h 6h 7h 8h
// 9h - with ranges: <5h, 5-6h, 6-7h, 7-8h, 8h+. Her own heading had always
// said "How long, roughly?", and nobody waking up knows they slept seven
// hours rather than seven and a quarter.
//
// WHAT GETS STORED IS THE MIDDLE OF THE BAND, because duration_min is a
// number and the recovery model needs one. WHAT GETS SHOWN BACK is the band
// again, for anything she reported herself - printing "7h 30m" when she
// tapped "7-8h" would be the app inventing a precision she did not claim.
//
// A NIGHT FROM THE PHONE IS EXACT AND IS SHOWN EXACTLY: 7h 46m is a measured
// figure, not a guess, and rounding it into a band would throw away the one
// advantage of having read it off a watch. The source column is what tells
// the two apart.
export const SLEEP_BANDS = [
  { key: 'under5', label: '<5h', min: 0, max: 299, store: 270 },
  { key: '5to6', label: '5-6h', min: 300, max: 359, store: 330 },
  { key: '6to7', label: '6-7h', min: 360, max: 419, store: 390 },
  { key: '7to8', label: '7-8h', min: 420, max: 479, store: 450 },
  { key: 'over8', label: '8h+', min: 480, max: Infinity, store: 510 },
] as const;

/** The band a stored figure falls in, for showing a self-reported night. */
export function bandLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  const band = SLEEP_BANDS.find((b) => minutes >= b.min && minutes <= b.max);
  return band ? band.label : null;
}

/**
 * How a night's length should read on screen.
 *
 * Exact when a phone measured it, a band when she estimated it. One function
 * so the card and the table can never disagree about the same night.
 */
export function durationForDisplay(
  minutes: number | null,
  source: string | null | undefined
): string | null {
  if (minutes == null) return null;
  return source === 'phone health platform' ? formatDuration(minutes) : bandLabel(minutes);
}
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
    .select('id, night_of, duration_min, quality, awakenings, source, went_to_bed, woke_at')
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
