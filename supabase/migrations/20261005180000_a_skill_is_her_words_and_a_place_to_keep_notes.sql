-- A SKILL IS HER OWN WORDS, AND A PLACE TO KEEP NOTES (Ruth, 5 October 2026).
--
--   "Skills is just a place to keep the things someone is working on. The user
--   does not know about progression ladders and does not need to. Progression
--   ladders are parked until the app is working well and real users have shown
--   which skills they keep."
--
-- WHAT A SKILL IS NOW, and nothing else: her own words as the title, where she is
-- with it, and the date it was added.
--
-- WHERE SHE IS WITH IT was being stored as a row per rung in user_skill_rungs,
-- which is a ladder's shape. It is one of three words on the skill itself.
alter table public.user_skills
  add column if not exists placement text;

comment on column public.user_skills.placement is
  'Where she is with it: starting, some, or nearly. Her three choices on screen 3 '
  'of setup, changeable later by a tap. Null means she did not say, which starts '
  'from the beginning. It replaces the per-rung rows for this purpose; '
  'user_skill_rungs is kept, unread, because ladders are parked rather than dropped.';

-- THE QUICK LOG. Her point 3, and the constraints are the design: "text only,
-- inside Skills. A short dated note on the skill, newest first, editable and
-- deletable, searchable and available to Report Builder. No tap button, no
-- session picker, nothing logs itself, no counts or streaks on the card."
--
-- SO THERE IS NO COUNT COLUMN AND NO STATUS. Anything this table could total
-- would become a streak on a card the moment somebody rendered it, and she has
-- said twice that Skills carries no score.
create table if not exists public.skill_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.user_skills(id) on delete cascade,
  -- Her words, as typed. Nothing parses this and no model is called on it.
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

comment on table public.skill_notes is
  'Short dated notes against a skill, in her words. Newest first, editable and '
  'deletable, searchable, and available to the Report Builder. Text only: no '
  'session link, no counts, no streaks. Nothing writes here except her, through '
  'the Skills tab or chat.';

create index if not exists skill_notes_user_skill_idx
  on public.skill_notes (user_id, skill_id, created_at desc);

-- SEARCHABLE, which is one of her four requirements for the note.
create index if not exists skill_notes_text_idx
  on public.skill_notes using gin (to_tsvector('english', note));

alter table public.skill_notes enable row level security;

drop policy if exists manage_own_skill_notes on public.skill_notes;
create policy manage_own_skill_notes on public.skill_notes
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
