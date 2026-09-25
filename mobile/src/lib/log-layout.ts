import { currentUserId } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';

// READING AND WRITING HER ARRANGEMENT OF A LIST (Ruth, 21 September 2026).
//
// TWO SCREENS USE THIS NOW, which is why it takes a column name. The Log rows
// came first; the Cycle cards asked for exactly the same thing a few hours
// later - "All cards should be moveable and hideable too" - and a second copy
// of this file would have been two sets of rules about the same question.
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

// THREE SCREENS NOW (Ruth, 25 September 2026, item 6: "Make sure all cards
// have been treated with the ability to be reordered and deleted at the main
// menu page, eg, log, plans, etc.").
//
// The Plans list is the first one whose ids are HER OWN ROWS rather than a
// fixed list the app ships, which is why the two rules above earn their keep
// here: a plan she deletes leaves a stale id in the saved order, and a plan she
// makes tomorrow is not in it at all. Ignored and appended respectively, with
// no special case needed for either.
/** Which list: each screen keeps its arrangement in its own column. */
export type LayoutKey = 'log_layout' | 'cycle_layout' | 'plans_layout';

export async function loadLayout(key: LayoutKey): Promise<LogLayout> {
  try {
    const userId = await currentUserId();
    if (!userId) return EMPTY;
    const { data } = await supabase
      .from('user_profile')
      .select(key)
      .eq('user_id', userId)
      .maybeSingle();
    return readLayout((data as Record<string, unknown> | null)?.[key]);
  } catch {
    // Her own order failing to load must never cost her the screen: the app's
    // own order is a perfectly good list.
    return EMPTY;
  }
}

/** Returns false when nothing was written, so a caller can say so rather than assume. */
export async function saveLayout(key: LayoutKey, layout: LogLayout): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase
      .from('user_profile')
      .upsert({ user_id: userId, [key]: layout }, { onConflict: 'user_id' });
    if (error) {
      console.log(`LAYOUT: could not save ${key} -`, error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
