import { supabase } from '@/lib/supabase';

// "Has this entry been discussed?" — the eye icon's state (build item 30,
// slice 3, per UNFLUMP_SPEC.md, The "What's In Here" Discuss-Card).
//
// The icon is neutral until a discussion exists against that entry, then
// changes permanently. There is deliberately no third "unread" state and no
// fading back — and permanence needs no logic to enforce, because chat messages
// are never deleted, so the set only ever grows.

export type DiscussEntryType = 'food' | 'activity' | 'measurement';

// Pure half, so the mapping is testable without Supabase. Rows may repeat an id
// (a discussion is many messages), hence a Set rather than a list.
export function toDiscussionSet(rows: { discuss_entry_id: string | null }[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (typeof r.discuss_entry_id === 'string' && r.discuss_entry_id.length > 0) {
      s.add(r.discuss_entry_id);
    }
  }
  return s;
}

// Which entries of this type have any discussion against them.
//
// ONE query for the whole view rather than one per row — a per-row check would
// fire a request for every line of the log. Backed by the partial index the
// slice-1 migration added on (user_id, discuss_entry_type, discuss_entry_id).
// RLS scopes the read, so no explicit user filter is needed.
export async function loadEntriesWithDiscussion(
  entryType: DiscussEntryType
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('discuss_entry_id')
    .eq('source', 'chat')
    .eq('discuss_entry_type', entryType)
    .not('discuss_entry_id', 'is', null);

  // On failure, every icon simply reads as undiscussed. Wrong in the quiet
  // direction: a missing highlight is a far smaller problem than a log that
  // won't render.
  if (error || !data) return new Set<string>();
  return toDiscussionSet(data as { discuss_entry_id: string | null }[]);
}
