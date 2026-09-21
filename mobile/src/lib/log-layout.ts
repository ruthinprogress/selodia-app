import { currentUserId } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';

// READING AND WRITING HER ARRANGEMENT OF THE LOG (Ruth, 21 September 2026).
//
// "I don't think everyone will want to log everything, so can we make the cards
// on the logging page so they can be reorganised by holding down and just
// moving up or down" - and, agreed on the follow-up, saved, with a way to hide
// a row rather than only sink it to the bottom.
//
// TWO RULES DECIDE EVERYTHING ELSE IN THIS FILE.
//
// AN UNKNOWN ID IS IGNORED, NOT KEPT. A saved order from an older version can
// name a row that no longer exists, and carrying it forward would mean an
// invisible gap in the list forever.
//
// A ROW SHE HAS NEVER SEEN APPEARS, AT THE END. When a new kind of logging
// ships, it must not be silently absent because her saved order predates it -
// that is the same failure as the unknown id, wearing the other face. So the
// stored order is a preference applied to the app's list, never a replacement
// for it.

import { EMPTY, readLayout, type LogLayout } from '@/lib/log-layout-rules';

export type { LogLayout };
export { arrange, layoutOf } from '@/lib/log-layout-rules';

export async function loadLogLayout(): Promise<LogLayout> {
  try {
    const userId = await currentUserId();
    if (!userId) return EMPTY;
    const { data } = await supabase
      .from('user_profile')
      .select('log_layout')
      .eq('user_id', userId)
      .maybeSingle();
    return readLayout(data?.log_layout);
  } catch {
    // Her own order failing to load must never cost her the screen: the app's
    // own order is a perfectly good list.
    return EMPTY;
  }
}

/** Returns false when nothing was written, so a caller can say so rather than assume. */
export async function saveLogLayout(layout: LogLayout): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase
      .from('user_profile')
      .upsert({ user_id: userId, log_layout: layout }, { onConflict: 'user_id' });
    if (error) {
      console.log('LOG LAYOUT: could not save -', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
