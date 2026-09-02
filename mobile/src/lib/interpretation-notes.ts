import { supabase } from '@/lib/supabase';

// Persisted per-entry interpretation notes (build item 29, Persisted
// Interpretation Notes).
//
// A NOTE IS A DIARY ENTRY, NOT A CACHE. Nothing here is an optimisation and
// nothing should ever be rewritten to behave like one. The stored sentence is a
// record of what Selodia actually said about one specific entry at the moment it
// said it — so a later, differently-worded interpretation of the same reading is
// DISCARDED rather than applied. If a period start is backdated weeks later and
// an old note is now slightly inconsistent with the corrected data, that is
// accepted and correct: the note still honestly reflects what was said.
//
// NOTHING DISPLAYS THESE YET, AND THAT IS EXPECTED. The surface for browsing a
// past entry's note is the discuss-card, which is item 30 slice 4 and is
// deliberately queued last behind on-device verification of the existing native
// modules. Until then notes accumulate correctly and appear in the data export,
// and no screen reads them. This module is written and complete regardless,
// because the value of a point-in-time record is entirely in having captured it
// at the time — waiting for the viewer would mean permanently losing every note
// from the intervening period.
//
// WHY ONLY THE MEASUREMENT NOTE. Point-in-time storage is only meaningful where
// the inputs can change retroactively. The body-measurement interpretation reads
// cycle_events (backdatable), the trend across LATER readings, and activity/food
// windows, so recomputing it a month on genuinely produces a different sentence.
// The per-item protein-quality flag is a deterministic function of
// food_items.protein_source, already persisted at log time and never changed, so
// computing it on read in food-breakdown-card.tsx is stable forever and a stored
// copy could only drift from its own input. It is deliberately not persisted —
// see SELODIA_SPEC.md, item 29.

// Kept in step with the migration's check constraint. food_log and activity_log
// are declared but not written today: the seam is real from the start rather
// than retrofitted, which is the whole reason the storage is type+id.
export type NoteEntryType = 'body_measurement' | 'food_log' | 'activity_log';

// Best-effort in both directions. A note is a nice-to-have record ABOUT a
// reading, never the reading itself, so a failure here must never break the
// surface that was showing the interpretation — the person still sees what
// Selodia said, which is the part that matters.
export async function persistNote(
  entryType: NoteEntryType,
  entryId: string,
  note: string
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // ignoreDuplicates is what makes this point-in-time rather than a cache:
    // the unique (user_id, entry_type, entry_id) means the first write wins and
    // every later one is a no-op. An upsert that merged would quietly replace
    // history with the present, which is exactly the failure this table exists
    // to prevent — so do NOT "fix" this to update on conflict.
    await supabase
      .from('interpretation_notes')
      .upsert(
        { user_id: user.id, entry_type: entryType, entry_id: entryId, note },
        { onConflict: 'user_id,entry_type,entry_id', ignoreDuplicates: true }
      );
  } catch {
    // Deliberately silent. See above.
  }
}

// Reads back what was said about one entry. No caller yet — item 30 slice 4 is
// the display surface. Written now so the store is complete rather than
// half-built, and so the read shape is settled before something depends on it.
export async function loadNoteFor(
  entryType: NoteEntryType,
  entryId: string
): Promise<string | null> {
  // RLS scopes this to the signed-in person, as everywhere else.
  const { data, error } = await supabase
    .from('interpretation_notes')
    .select('note')
    .eq('entry_type', entryType)
    .eq('entry_id', entryId)
    .maybeSingle();
  if (error) return null;
  return data?.note ?? null;
}
