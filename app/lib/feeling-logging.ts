import type { SupabaseClient } from '@supabase/supabase-js';

import { type SpokenFeeling } from './spoken-day';

// HOW A DAY FELT, SAID OUT LOUD (Ruth, 21 September 2026).
//
// Her reason for putting mood back, which is also the reason it has to be
// speakable and not only tappable:
//
//   "just voice logging meant that users had no idea what was available ...
//   catching things like low mood always 2 days after cocktails eg, could
//   genuinely be unknown to a user and needs something to check if Ai says it."
//
// The screen is how somebody finds out the thing exists. Speech is how they use
// it on the day they least feel like opening a screen, which is the day the
// record matters most.
//
// THE WORDS HAVE TO MATCH THE SCREEN'S WORDS. "Flat" tapped on the Feeling page
// and "flat" said in chat must store the same number, or a fortnight of
// ratings is two scales wearing one name. mobile/src/lib/daily-ratings.ts is
// where the screen gets them; probe-spoken-day.mjs imports both files and
// fails if they ever drift apart.

export const MEASURE_WORDS: Record<string, readonly string[]> = {
  mood: ['Low', 'Flat', 'Steady', 'Good', 'Bright'],
  energy: ['Drained', 'Tired', 'Steady', 'Lively', 'Buzzing'],
};

export function wordFor(measure: string, value: number): string | null {
  const words = MEASURE_WORDS[measure];
  if (!words) return null;
  const at = Math.round(value) - 1;
  return at >= 0 && at < words.length ? words[at] : null;
}

/**
 * One row per measure they gave, replacing whatever that day already held.
 *
 * A DAY HAS ONE ANSWER PER MEASURE. Saying "actually today was more of a good
 * day" an hour later is a correction, not a second reading, so this upserts on
 * the table's own key rather than appending. That is also why a measure they
 * did NOT mention is left alone: mentioning energy does not retract what they
 * said about mood this morning.
 */
export async function writeFeeling(
  supabase: SupabaseClient,
  userId: string,
  felt: SpokenFeeling
): Promise<SpokenFeeling | null> {
  const now = new Date().toISOString();
  const rows = (['mood', 'energy'] as const)
    .filter((m) => felt[m] != null)
    .map((m) => ({
      user_id: userId,
      day: felt.day,
      measure: m,
      value: felt[m] as number,
      updated_at: now,
      // A NOTE IS ONLY WRITTEN WHEN THERE IS ONE. PostgREST updates the columns
      // it is sent, so leaving `note` out keeps whatever the day already had.
      // Sending null instead would let "energy was low" erase the sentence they
      // typed this morning explaining why - a write that deletes correct work.
      ...(felt.note ? { note: felt.note } : {}),
    }));
  if (rows.length === 0) return null;

  const { error } = await supabase.from('daily_ratings').upsert(rows, { onConflict: 'user_id,day,measure' });
  if (error) {
    console.log('FEELING WRITE FAILED:', error.message);
    return null;
  }
  return felt;
}
