import type { DeletableTable } from '@/lib/delete-entry';
import { archiveDeleted, purgeExpired } from '@/lib/recoverable';
import { supabase } from '@/lib/supabase';

// REMOVING ONE LOGGED ENTRY, RECOVERABLY, WHATEVER TABLE IT LIVES IN.
//
// Ruth, 27 September 2026, item 2: every entry line in Food, Movement and
// Measurements uses "the shared swipe-to-delete component, with the undo toast
// and soft delete". The measurements path already had both; food and movement
// had a plain delete and nothing else, so this is the missing half rather than
// a new idea.
//
// READ FIRST, THEN DELETE, and that order is the whole point. An undo has to
// put back what was actually there, and after the row is gone nothing knows
// what that was - the old delete threw away the only copy at the moment it
// became irreplaceable. Her sentence about re-entering readings from memory is
// the argument: "that day's record is now less accurate than the original".
//
// WHY NOT A deleted_at COLUMN. See lib/recoverable.ts. In short: a flag means
// every read has to filter and one missed filter shows somebody data they
// deleted, which on a body record is worse than having no recovery at all.

/** What it takes to put one entry back, and what to call it while offering. */
export type Undo = {
  /** Said in the toast. Her words for the thing, not the table's. */
  label: string;
  restore: () => Promise<boolean>;
};

/**
 * Take a row out of the live table, keep a copy for seven days, and hand back
 * the means to undo it.
 *
 * Returns null when nothing was removed, so a caller can say so rather than
 * show an undo for something that is still there.
 */
export async function removeEntry(
  table: DeletableTable,
  id: string,
  label: string
): Promise<Undo | null> {
  const { data, error: readError } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readError || !data) {
    console.log('REMOVE ENTRY: could not read it first -', readError?.message ?? 'no row');
    return null;
  }

  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.log('REMOVE ENTRY FAILED:', error.message);
    return null;
  }

  const row = data as Record<string, unknown>;
  void archiveDeleted('entry', label, { kind: 'table-row', table, row });
  void purgeExpired();

  return {
    label,
    restore: async () => {
      // Carries its original id, so pressing undo twice writes the same row
      // twice and the second is a conflict rather than a duplicate entry.
      const { error: putBack } = await supabase.from(table).upsert(row);
      if (putBack) console.log('REMOVE ENTRY: could not put it back -', putBack.message);
      return !putBack;
    },
  };
}
