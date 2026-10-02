-- HOW SHE WANTS HER DAYS TO FEEL, AND WHICH WAY THEY ARE MOVING.
--
-- Ruth, 2 October 2026, item 7: "Purpose: take mental load off, reduce friction
-- and stress, support long-term health. Add goal kind 'feel': chips (More
-- energy, Less overwhelm, Less brain fog, Feel stronger, Sleep better, Calmer)
-- plus her own words, saved with a starting snapshot (started_at). Each look-back
-- is a row with one of four answers (further / same / a bit closer / closer) and
-- an optional note. No scores, streaks, counters or percentages."
--
-- WHY THIS IS A SEPARATE TABLE AND NOT A `kind` ON user_goals. A body goal
-- resolves to arithmetic - a focus pair, a calorie figure, a protein range. A
-- feel goal resolves to nothing calculable, and must not: it is the guiding
-- source for tone and priorities, not an input to a target. Sharing a table would
-- have put "Less brain fog" one join away from the code that computes deficits,
-- and the first person to write `select * from user_goals` in the targets path
-- would have had to remember which rows were not for them.
--
-- THE SNAPSHOT IS THE POINT, which is why started_at is NOT NULL. The app cannot
-- promise to fix any of this; what it can do is hold where she was starting from
-- so a look-back has something to compare against. A feel goal with no start date
-- is a wish with nothing behind it.
--
-- FOUR ANSWERS, NO SCALE. 'further', 'same', 'a_bit_closer', 'closer' - her own
-- four, in her order. Deliberately NOT 1-5, not a percentage and not a streak:
-- a number invites a graph, a graph invites a trend line, and a trend line on how
-- somebody's days feel is a judgement dressed as data. There is no column here
-- that could be averaged.
--
-- A LOOK-BACK IS ABOUT HER DAYS, NOT ABOUT ONE CHIP. Her approved screen shows
-- every starting chip together and asks one question underneath them. So a row
-- here answers the whole snapshot. `feel_goal_id` is nullable for the case where
-- she ever wants to answer about one of them, and is null for every row the
-- current screen writes.

create table if not exists feel_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- A chip's label, or her own words. Stored as she gave it.
  label text not null,
  -- Whether it came from a chip or from the box, so the screen can show her own
  -- sentence as a sentence rather than as another chip.
  source text not null default 'chip' check (source in ('chip', 'her words')),
  -- WHERE SHE WAS STARTING FROM. Not nullable: see the header.
  started_at timestamptz not null default now(),
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists feel_goals_user on feel_goals (user_id, archived_at);

create table if not exists feel_lookbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null for a look-back about her days as a whole, which is all the screen
  -- writes today. See the header.
  feel_goal_id uuid references feel_goals(id) on delete cascade,
  answer text not null check (answer in ('further', 'same', 'a_bit_closer', 'closer')),
  -- "Anything you want to remember about why? Optional." Her words, kept as-is.
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feel_lookbacks_user on feel_lookbacks (user_id, created_at desc);

alter table feel_goals enable row level security;
alter table feel_lookbacks enable row level security;

drop policy if exists manage_own on feel_goals;
create policy manage_own on feel_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists manage_own on feel_lookbacks;
create policy manage_own on feel_lookbacks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

comment on table feel_goals is
  'How she wants her days to feel. Item 7, 2 October 2026. NOT user_goals: a body goal resolves to arithmetic and this must never be an input to a target. No column here can be scored, averaged or counted.';
comment on table feel_lookbacks is
  'One row per look-back: four answers and an optional note. No scale, because a number invites a trend line and a trend line on how somebody feels is a judgement dressed as data.';
