import { supabase } from '@/lib/supabase';

// "Has the Almanac orientation been seen?" (build item 15, UI slice 5 — Part
// Ten, First-view introduction).
//
// STORED ON THE ACCOUNT, in `user_profile.almanac_intro_seen_at`. Null means
// never seen. Mirrors `cycle_prompt_dismissed_at` exactly — same table, same
// nullable timestamptz, same stamp-on-dismiss — because that column is the
// project's established "this has been shown once" pattern and a second concept
// would be one more thing to learn for no gain.
//
// THIS REPLACED AN ASYNCSTORAGE FLAG (2026-08-31, same day it shipped). The
// first version was device-local because that slice was scoped against schema
// changes; the effect was that the card returned after a reinstall and appeared
// again on a second device. Being shown around a room is something that happens
// to a person, not to a handset, so the fact belongs on the account. Kept here
// as a note rather than a git-history footnote: the AsyncStorage version looked
// perfectly reasonable in isolation, and the reason it was wrong is only visible
// from the user's side.
//
// Both reads and writes fail SOFT, and in the same direction: on any error we
// behave as though the card has already been seen. Showing an orientation card
// on someone's hundredth visit is a worse wrong answer than never showing it at
// all, and neither is worth an error state on a page someone just opened.

export async function hasSeenAlmanacIntro(): Promise<boolean> {
  try {
    // RLS scopes user_profile to the signed-in user, so no explicit filter —
    // the same read the cycle prompt does.
    const { data, error } = await supabase
      .from('user_profile')
      .select('almanac_intro_seen_at')
      .maybeSingle();
    if (error) return true;
    return data?.almanac_intro_seen_at != null;
  } catch {
    return true;
  }
}

// Best-effort. If the stamp fails the card simply appears once more next time,
// which is a far better outcome than an error surfacing on a dismiss tap.
export async function markAlmanacIntroSeen(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profile')
      .upsert({ user_id: user.id, almanac_intro_seen_at: new Date().toISOString() });
  } catch {
    // Intentionally swallowed — see above.
  }
}
