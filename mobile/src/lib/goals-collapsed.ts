import { supabase } from '@/lib/supabase';

// IS THE "WORKING TOWARDS" CARD FOLDED SHUT?
//
// Ruth, 1 October 2026, UI item 1. Stored in `user_profile.goals_collapsed`,
// mirroring almanac-intro.ts: same table, same read-on-focus, same soft failure.
//
// A PRIVACY PREFERENCE, WHICH DECIDES BOTH DEFAULTS BELOW. Her words: the collapse
// is "a privacy feature, allowing users to comfortably open Selodía in public".
// So the two failure directions are not symmetrical, and this file picks a side
// each time:
//
//   READING fails      ->  assume OPEN (false). A card that fails to appear is a
//                          layout annoyance she can see and fix. Defaulting to
//                          collapsed on a network blip would quietly hide her
//                          goals and look like data loss.
//   WRITING fails      ->  SAY SO, by returning false. This is the one that
//                          matters: she taps to hide her goals, the write fails,
//                          and on the next visit they are on show again in
//                          whatever room she is in. The caller keeps the UI
//                          collapsed for this session either way, so the fold
//                          always LOOKS like it worked - but a silent failure
//                          here is a promise about privacy that was not kept.
//
// Which is why this returns a boolean instead of swallowing the error the way
// markMoveUsed does. There the lost thing is a hint; here it is her goals.

export async function readGoalsCollapsed(): Promise<boolean> {
  try {
    // RLS scopes user_profile to the signed-in user, so no explicit filter.
    const { data, error } = await supabase
      .from('user_profile')
      .select('goals_collapsed')
      .maybeSingle();
    if (error) return false;
    return data?.goals_collapsed === true;
  } catch {
    return false;
  }
}

/** Returns whether it was actually stored. See the note above on why. */
export async function writeGoalsCollapsed(collapsed: boolean): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from('user_profile')
      .update({ goals_collapsed: collapsed })
      .eq('user_id', user.id);
    return !error;
  } catch {
    return false;
  }
}
