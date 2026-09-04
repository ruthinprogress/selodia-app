import { supabase } from '@/lib/supabase';

// "You can also log this in Chat", shown once per detail screen and then never
// again.
//
// STORED ON THE ACCOUNT, in user_profile. Mirrors hasSeenAlmanacIntro and
// hasSeenChatChips exactly - same table, same nullable timestamptz, same
// stamp-on-dismiss - because that is this project's established "shown once"
// pattern and a second concept would be one more thing to learn for no gain.
//
// DELIBERATELY NOT ASYNCSTORAGE. That was tried and reversed on 2026-08-31 for
// the Almanac card: a device flag brings the hint back after a reinstall and
// again on a second device. Being shown something happens to a person, not to a
// handset.
//
// BOTH READS AND WRITES FAIL SOFT, IN THE SAME DIRECTION: on any error, behave
// as though the hint has already been seen. A one-time tip appearing on
// somebody's hundredth visit is a worse wrong answer than one that never
// appears, and neither deserves an error state on a screen just opened.

export type TooltipTab = 'food' | 'activity' | 'body';

const COLUMN: Record<TooltipTab, string> = {
  food: 'food_tab_tooltip_seen_at',
  activity: 'activity_tab_tooltip_seen_at',
  body: 'body_tab_tooltip_seen_at',
};

export async function hasSeenTabTooltip(tab: TooltipTab): Promise<boolean> {
  try {
    // RLS scopes user_profile to the signed-in user, so no explicit filter.
    const { data, error } = await supabase.from('user_profile').select(COLUMN[tab]).maybeSingle();
    if (error) return true;
    const row = data as Record<string, unknown> | null;
    return row?.[COLUMN[tab]] != null;
  } catch {
    return true;
  }
}

// Best-effort. If the stamp fails the hint simply appears once more next time,
// which is a far better outcome than an error surfacing on a dismiss tap.
export async function markTabTooltipSeen(tab: TooltipTab): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profile')
      .upsert({ user_id: user.id, [COLUMN[tab]]: new Date().toISOString() });
  } catch {
    // Intentionally swallowed - see above.
  }
}
