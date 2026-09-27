import { currentUserId } from '@/lib/current-user';
import { restoreReading, type ReadingRestore } from '@/lib/delete-reading';
import { supabase } from '@/lib/supabase';

// A DELETE THAT CAN BE UNDONE FOR SEVEN DAYS (Ruth, 26 September 2026, item 8).
//
// "I deleted Thu 24 Sept's readings by mistake and had no way to get them back.
// Re-entering them through chat isn't a real fallback: users don't remember
// exact values (I re-entered from memory and rounded, so that day's record is
// now less accurate than the original)."
//
// The ten-second Undo already built covers the wrong tap. This covers the
// regret: "bring back Thursday's weight", days later, with the numbers it
// actually had.
//
// ARCHIVED OUT, NOT FLAGGED IN PLACE, and the reason matters more than the
// mechanism. The obvious shape is a `deleted_at` column on each table and a
// filter on every read. That means every existing query has to learn about it,
// every future query has to remember, and ONE MISSED FILTER SHOWS SOMEBODY
// DATA THEY DELETED. On a body record that is the worst failure this feature
// could have - worse than not having it - because the person has already
// decided they did not want to see it.
//
// So the row leaves the live table exactly as it does today, and a copy goes
// into `deleted_records`. Reads need no changes at all, which means there is
// nothing to miss. The cost is that a restore is a write rather than a flag
// flip, which is fine: restores are rare and deletes are not.
//
// THE PAYLOAD IS A RESTORE DESCRIPTOR, NOT A RAW ROW. A scale reading is a
// COLUMN of a shared row - weight, body fat and muscle are written together -
// so "what was deleted" cannot always be expressed as a row. delete-reading.ts
// already works this out and hands back exactly what is needed to put it back;
// this stores that.

/** How long a deleted record can be brought back. Her figure. */
export const RECOVERY_DAYS = 7;

export type RecoverableKind = 'reading';

export type Recoverable = {
  id: string;
  kind: RecoverableKind;
  /** What it was, in her words, for the chat to name it back to her. */
  label: string;
  deleted_at: string;
};

/**
 * Keep a copy of what was just removed.
 *
 * Best-effort and silent on failure: the delete has already succeeded by the
 * time this runs, and an archive that fails must never present as a failed
 * delete. It costs recoverability, not correctness.
 */
export async function archiveDeleted(
  kind: RecoverableKind,
  label: string,
  payload: ReadingRestore
): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    await supabase.from('deleted_records').insert({ user_id: userId, kind, label, payload });
  } catch {
    // Intentionally swallowed - see above.
  }
}

/**
 * What can still be brought back, newest first.
 *
 * Anything past the window is not returned even if it is still in the table,
 * so the promise the app makes does not depend on the purge having run. A
 * record that is one day over is gone as far as anybody asking is concerned.
 */
export async function recoverable(): Promise<Recoverable[]> {
  try {
    const userId = await currentUserId();
    if (!userId) return [];
    const since = new Date(Date.now() - RECOVERY_DAYS * 86_400_000).toISOString();
    const { data } = await supabase
      .from('deleted_records')
      .select('id, kind, label, deleted_at')
      .eq('user_id', userId)
      .gte('deleted_at', since)
      .order('deleted_at', { ascending: false });
    return (data ?? []) as Recoverable[];
  } catch {
    return [];
  }
}

/** Put one back, and stop offering it. Returns false when nothing changed. */
export async function recover(id: string): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const since = new Date(Date.now() - RECOVERY_DAYS * 86_400_000).toISOString();
    const { data } = await supabase
      .from('deleted_records')
      .select('payload, deleted_at')
      .eq('id', id)
      .eq('user_id', userId)
      .gte('deleted_at', since)
      .maybeSingle();
    const payload = (data as { payload?: ReadingRestore } | null)?.payload;
    if (!payload) return false;

    const ok = await restoreReading(payload);
    // The archive row goes only on success. A restore that failed and then
    // forgot what it was trying to restore would lose the record twice.
    if (ok) await supabase.from('deleted_records').delete().eq('id', id).eq('user_id', userId);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Drop anything past the window.
 *
 * Called opportunistically when the app archives something, rather than on a
 * schedule: this app has no cron, and a purge that only runs when somebody is
 * already deleting is a purge that runs exactly when the table is growing.
 * A few stale rows between deletes cost nothing, because `recoverable` and
 * `recover` both refuse them on age regardless.
 */
export async function purgeExpired(): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const cutoff = new Date(Date.now() - RECOVERY_DAYS * 86_400_000).toISOString();
    await supabase.from('deleted_records').delete().eq('user_id', userId).lt('deleted_at', cutoff);
  } catch {
    // Silent: a purge that fails is a table that is slightly larger.
  }
}
