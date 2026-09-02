-- Persisted per-entry interpretation notes (Persisted Interpretation Notes,
-- build item 29).
--
-- A NOTE IS A DIARY ENTRY, NOT A CACHE, and that is the entire design. The spec
-- draws this as a deliberate architectural split from the compute-on-read
-- decision made for cycle day: a recalculated value should always be current,
-- whereas a note is a record of what Selodia actually said at the time. It
-- follows that a retroactively-corrected input - a period start backdated weeks
-- later - can leave an older note slightly inconsistent with the corrected data.
-- That is accepted and correct. The note still honestly reflects what was said.
--
-- WHY THE MEASUREMENT NOTE EARNS THIS AND THE PROTEIN FLAG DOES NOT. Point-in-
-- time storage is only meaningful where the inputs themselves can change
-- retroactively. The body-measurement interpretation reads cycle_events (which
-- are backdatable), the trend across LATER readings, and activity/food windows -
-- recompute it in a month and it genuinely says something different from what
-- the person was shown. The per-item protein-quality flag is a deterministic
-- function of food_items.protein_source, which is already persisted at log time
-- and never changes, so recomputing it on read is stable forever and a stored
-- copy could only ever drift from its own input. It is therefore deliberately
-- NOT persisted here - recorded in the spec under item 29 with this reasoning,
-- so the omission reads as a decision rather than an oversight.
--
-- TYPE + ID, NO FOREIGN KEY, exactly as chat_messages.discuss_entry_id /
-- discuss_entry_type already does (20260821190000) and for the same reason: the
-- mechanic spans food, activity and measurement entries living in DIFFERENT
-- tables, and a single FK column cannot point at three of them. The check
-- constraint names all three now, though only body_measurement is written today,
-- so the seam is real rather than retrofitted later.
--
-- The cost of no FK is that a deleted entry leaves its note orphaned. Accepted:
-- entries are corrected far more often than deleted, per-user volume is tiny,
-- and account deletion reaches this table through user_id's cascade like
-- everything else.
create table interpretation_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (
    entry_type in ('body_measurement', 'food_log', 'activity_log')
  ),
  -- The id of the row in whichever table entry_type names. Deliberately not a
  -- foreign key - see above.
  entry_id uuid not null,
  -- The composed message, stored as the finished sentence rather than as the
  -- flags behind it. Storing the parts would mean re-composing on read, which is
  -- the recalculation this table exists to avoid.
  note text not null,
  created_at timestamptz not null default now(),
  -- One note per entry, forever. The write path relies on this to keep the
  -- FIRST interpretation of a reading: a later write for the same entry is
  -- discarded, not applied, because the point is what was said at the time.
  unique (user_id, entry_type, entry_id)
);

create index interpretation_notes_lookup_idx
  on interpretation_notes (user_id, entry_type, entry_id);

alter table interpretation_notes enable row level security;

create policy "manage_own" on interpretation_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
