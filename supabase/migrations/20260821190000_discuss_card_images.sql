-- Discuss-card "Ask about this" plumbing (build item 30, slice 1).
--
-- Tapping "Ask about this" carries the entry's breakdown card into the chat
-- thread AS AN IMAGE, so the person and Unflump are demonstrably looking at the
-- same thing rather than the model being handed structured data invisibly
-- (SELODIA_SPEC.md, The "What's In Here" Discuss-Card).
--
-- Three additions to chat_messages:
--   image_path          the Storage object holding that posted card
--   image_sent_to_model sent to the model exactly ONCE, on the posting turn -
--                       re-sending on every later turn would charge vision
--                       tokens for the whole conversation to no benefit
--   discuss_entry_*     the entry a message belongs to, tagged from the posting
--                       turn forward for the natural life of that thread. Kept
--                       as (type, id) rather than a foreign key precisely
--                       BECAUSE the discuss mechanic is entry-type-agnostic:
--                       the same card carries food, activity and measurement
--                       entries, which live in different tables. Only 'food' is
--                       wired today (items 38/39 bring the others); the check
--                       constraint names all three so the seam is real, not
--                       retrofitted later.

alter table chat_messages add column image_path text;
alter table chat_messages add column image_sent_to_model boolean not null default false;
alter table chat_messages add column discuss_entry_id uuid;
alter table chat_messages add column discuss_entry_type text
  check (discuss_entry_type in ('food', 'activity', 'measurement'));

-- Both discuss columns travel together or not at all: an id with no type can't
-- be resolved to a table, and a type with no id points at nothing.
alter table chat_messages add constraint chat_messages_discuss_entry_pair
  check (num_nonnulls(discuss_entry_id, discuss_entry_type) <> 1);

-- Pulling a single entry's Q&A history back out of the date-scrolled thread is
-- the whole point of the tagging, so index the lookup.
create index chat_messages_discuss_entry_idx
  on chat_messages (user_id, discuss_entry_type, discuss_entry_id)
  where discuss_entry_id is not null;

-- Finding the one unsent card image on each turn must not scan the thread.
create index chat_messages_pending_image_idx
  on chat_messages (user_id, created_at)
  where image_path is not null and image_sent_to_model = false;

-- Private bucket for the posted card images. Not public: these are a rendering
-- of the person's own food log, which is health data.
insert into storage.buckets (id, name, public)
values ('discuss-cards', 'discuss-cards', false)
on conflict (id) do nothing;

-- Per-user isolation by path prefix: every object lives under {user_id}/...,
-- matching the RLS posture of every other table in this schema.
create policy "discuss_cards_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'discuss-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "discuss_cards_select_own" on storage.objects for select
  using (
    bucket_id = 'discuss-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "discuss_cards_delete_own" on storage.objects for delete
  using (
    bucket_id = 'discuss-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
