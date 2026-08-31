import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// "Has the Almanac orientation been seen?" (build item 15, UI slice 5 — Part
// Ten, First-view introduction).
//
// WHY ASYNCSTORAGE AND NOT A COLUMN. The project's existing dismiss-once
// precedent is `user_profile.cycle_prompt_dismissed_at` — a database column,
// stamped on dismiss and read back on load. That is the better pattern and this
// deliberately does NOT follow it, for one reason: it would need a schema
// change, which this slice is explicitly scoped out of.
//
// The trade-off is real and worth knowing rather than discovering. A device-local
// flag means the orientation reappears after a reinstall, and appears again on a
// second device. For a one-line "this is what this room is" card that is a mild
// repeat, not a broken promise — the cycle prompt earned a column because
// re-asking someone about their cycle is genuinely intrusive; re-introducing a
// page is not. If this ever needs to be account-level, the move is a column
// alongside `cycle_prompt_dismissed_at`, not a bigger local store.
//
// KEYED PER USER so signing in as someone else on a shared device gives that
// person their own orientation rather than silently skipping it.
const KEY_PREFIX = 'almanac.intro.seen.';

// Expo Router's web static-rendering pass runs in Node with no window or
// localStorage, and AsyncStorage's web shim needs both. supabase.ts guards its
// auth storage the same way; the same guard applies here.
const isSsr = Platform.OS === 'web' && typeof window === 'undefined';

export function almanacIntroKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

// Defaults to "already seen" on any failure. A storage read that throws should
// not produce an orientation card on someone's hundredth visit — showing it
// again is the worse of the two wrong answers, so the failure mode is silence.
export async function hasSeenAlmanacIntro(userId: string): Promise<boolean> {
  if (isSsr || !userId) return true;
  try {
    return (await AsyncStorage.getItem(almanacIntroKey(userId))) != null;
  } catch {
    return true;
  }
}

// Best-effort. If this write fails the card simply appears once more next time,
// which is a far better outcome than an error surfacing on a dismiss tap.
export async function markAlmanacIntroSeen(userId: string): Promise<void> {
  if (isSsr || !userId) return;
  try {
    await AsyncStorage.setItem(almanacIntroKey(userId), new Date().toISOString());
  } catch {
    // Intentionally swallowed — see above.
  }
}
