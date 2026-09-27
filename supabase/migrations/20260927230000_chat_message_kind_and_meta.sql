-- A CHAT ROW CAN SAY WHAT KIND OF THING IT IS (2026-09-27, Ruth's item 9).
--
-- The weekly roundup arrives in the thread as an ordinary assistant message, so
-- Chat had no way to tell it from any other paragraph and drew it as one. Her ask
-- is for it to be its own card, with the week's figures as rows.
--
-- WHY NOT `source`. Chat reads `.eq('source', 'chat')`, and onboarding rows are
-- excluded by exactly that filter - so putting 'roundup' in `source` would have
-- removed the roundup from the thread it is meant to appear in. `kind` is a
-- second, orthogonal fact about the same row: source says where it came from,
-- kind says what it is.
--
-- BOTH NULLABLE, so every row written before today and every ordinary turn after
-- it are untouched and mean exactly what they meant before. There is no default
-- and no backfill: a null kind is an ordinary message, which is what they are.
alter table public.chat_messages
  add column if not exists kind text,
  add column if not exists meta jsonb;

comment on column public.chat_messages.kind is
  'What this message IS, when it is not an ordinary turn: currently only ''roundup''. Null means an ordinary message. Separate from source, which says where it came from.';

comment on column public.chat_messages.meta is
  'Structured data the client draws alongside the text - the roundup''s computed figures. Never a substitute for the message content, which must stand alone if nothing reads this.';

-- Only the roundup lookups filter on it, and they are per user and recent, so a
-- partial index on the non-null values is the whole cost.
create index if not exists chat_messages_kind_idx
  on public.chat_messages (user_id, kind, created_at desc)
  where kind is not null;
