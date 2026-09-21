import type { SupabaseClient } from '@supabase/supabase-js';

import { type SpokenCycle } from './spoken-day';

// A PERIOD RECORDED BY SAYING SO (Ruth, 21 September 2026).
//
//   "the cycle 'started' and 'ended' needs to be sleecteable in hindsight. I
//   rarelt rememebr to add it to my calendar on the day it started or ended.
//   And also, the chat should be able to fill it in directly from just
//   speaking."
//
// The Cycle page answers the first half. This answers the second, and the two
// halves are the same feature: somebody who did not open the app on the day it
// started is exactly the person who will mention it in passing three days
// later. "My period started on Tuesday" has to land on Tuesday.
//
// UPSERT, NOT INSERT. Cycle length is arithmetic on the gaps between these
// rows, so a duplicate is not cosmetic - two starts on one day is a zero-length
// cycle in an average that steers a prediction for months. The unique index
// added with this feature makes saying it twice land once, whether the second
// telling came from the chat, the Cycle page or a correction the next morning.
//
// NOTHING IS PARSED HERE. The date came from the model, as it does for food and
// activity, and was checked in spoken-day.ts before it reached this file.

export async function writeCycleEvent(
  supabase: SupabaseClient,
  userId: string,
  event: SpokenCycle
): Promise<SpokenCycle | null> {
  const { error } = await supabase.from('cycle_events').upsert(
    {
      user_id: userId,
      event_date: event.day,
      event_type: event.type,
    },
    { onConflict: 'user_id,event_date,event_type' }
  );
  if (error) {
    console.log('CYCLE EVENT WRITE FAILED:', error.message);
    return null;
  }
  return event;
}
