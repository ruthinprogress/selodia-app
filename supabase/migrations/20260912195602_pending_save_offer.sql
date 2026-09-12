-- The conversational save (build spec, Part Ten: Insights slice 2, 2026-09-12).
-- An Almanac save Selodia has OFFERED and not yet had answered. The offer is
-- stored, not remembered: the model only reports whether the answer was yes, and
-- the app saves exactly what was offered. Same pattern as pending_fat_focus.
--
-- Applied to the database through the Supabase MCP as `pending_save_offer`
-- (version 20260912195602). Kept here too, because the nine migrations applied
-- the same way since 4 September exist only in the database's history.
alter table user_profile
  add column if not exists pending_save jsonb,
  add column if not exists pending_save_asked_at timestamptz;

comment on column user_profile.pending_save is
  'An Almanac save Selodia offered and has not had answered: {type, title, content}. Cleared on yes (after saving) or no. See app/lib/pending-save.ts.';
comment on column user_profile.pending_save_asked_at is
  'When the pending save was offered. Offers expire after 48 hours.';
