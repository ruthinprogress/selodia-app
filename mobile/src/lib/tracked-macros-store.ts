import { currentUserId } from '@/lib/current-user';
import { supabase } from '@/lib/supabase';
import { toStored, trackedMacros, type MacroKey } from '@/lib/tracked-macros';

// WHERE "WHAT I TRACK" LIVES (24 September 2026).
//
// user_profile.tracked_macros, beside log_layout and cycle_layout, because it
// is the same shape of thing: a short list of choices about how her own app
// behaves. Same read/write pattern as log-layout.ts, deliberately - a second
// way of storing a preference set would be a second thing to get wrong.
//
// ONLY THE OPTIONAL SIX ARE EVER STORED. Calories and protein are added when
// the value is read, so there is no stored value - not a corrupted one, not a
// hand-edited one, not one written by an older build - that can express them
// as off. See tracked-macros.ts for why that is a product decision.

export type { MacroKey };

/** What to show, for the signed-in person. Always includes calories and protein. */
export async function loadTrackedMacros(): Promise<MacroKey[]> {
  try {
    const userId = await currentUserId();
    if (!userId) return trackedMacros(null);
    const { data } = await supabase
      .from('user_profile')
      .select('tracked_macros')
      .eq('user_id', userId)
      .maybeSingle();
    return trackedMacros((data as { tracked_macros?: unknown } | null)?.tracked_macros);
  } catch {
    // Her choices failing to load must never cost her the screen. The default
    // pair is a perfectly good row.
    return trackedMacros(null);
  }
}

/** Returns false when nothing was written, so a caller can say so rather than assume. */
export async function saveTrackedMacros(keys: MacroKey[]): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase
      .from('user_profile')
      .upsert({ user_id: userId, tracked_macros: toStored(keys) }, { onConflict: 'user_id' });
    if (error) {
      console.log('TRACKED MACROS: could not save -', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
