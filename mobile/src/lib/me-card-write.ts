import { readMeCard, type MeStatus } from '@/lib/me-card';
import { supabase } from '@/lib/supabase';

// CHANGING A Me CARD FROM THE CARD ITSELF (Ruth, 25 September 2026, item 15).
//
// THIS REVERSES A STANDING DECISION, and the decision is worth quoting because
// it was a good one. almanac.tsx said, in as many words: "Editing is
// conversational, always: this hands the entry to Chat with the opening line
// already written, rather than opening any form. Selodia stays the only
// writer."
//
// Her item 15 asks for both: a "Talk this through" link that does exactly what
// the old rule describes, AND an "Edit" that changes the entry in place. That
// is not a contradiction once you look at what each is for. Talking it through
// is how a DECISION changes - the dose, whether to keep taking it, why. Typing
// is how a MISTAKE is fixed: a name spelled wrong, a status left on Taking
// after she stopped. Nobody wants a conversation to correct a typo, and a form
// is a poor place to change your mind about a supplement.
//
// So: the conversation still owns the substance and this owns the record of it.
//
// A STATUS CHANGE WRITES ITSELF INTO THE HISTORY. The card's history is
// described as "how it has changed... as told in conversation", and a toggle on
// a card is not a conversation - so without this, tapping Paused would silently
// lose the fact that anything happened. It appends the same shape the
// conversation writes, with no reason, because none was given.

export type MeCardPatch = {
  title?: string;
  /** The section it sits under; `category` on the row. */
  category?: string | null;
  why?: string | null;
  detail?: string | null;
  status?: MeStatus | null;
};

/** Today, as the history stores dates. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Apply a patch to one Me card. True when the row changed.
 *
 * Reads the entry first rather than writing a whole content object from the
 * screen's state: a card can carry fields this app does not know about - it is
 * deliberately forgiving about what it renders - and a blind overwrite would
 * throw them away. Only the named fields move.
 */
export async function updateMeCard(id: string, patch: MeCardPatch): Promise<boolean> {
  const { data, error } = await supabase
    .from('almanac_entries')
    .select('content')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.log('ME CARD UPDATE: could not read the entry -', error?.message ?? 'no row');
    return false;
  }

  const existing =
    data.content != null && typeof data.content === 'object' && !Array.isArray(data.content)
      ? (data.content as Record<string, unknown>)
      : {};
  const card = readMeCard(existing);

  const content: Record<string, unknown> = { ...existing };
  if (patch.why !== undefined) content.why = patch.why;
  if (patch.detail !== undefined) content.detail = patch.detail;

  if (patch.status !== undefined && patch.status !== card.status) {
    content.status = patch.status;
    // The record of the change, in the same shape the conversation writes.
    content.history = [
      ...card.history,
      { date: today(), status: patch.status, reason: null },
    ];
  }

  const row: Record<string, unknown> = { content };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.category !== undefined) row.category = patch.category;

  const { error: writeError } = await supabase.from('almanac_entries').update(row).eq('id', id);
  if (writeError) {
    // Said, not swallowed: a change that looks saved and is not is the one
    // thing an edit form must never do.
    console.log('ME CARD UPDATE FAILED:', writeError.message);
    return false;
  }
  return true;
}
