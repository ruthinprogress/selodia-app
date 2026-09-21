-- HOW A DAY FELT, ON MORE THAN ONE AXIS (Ruth, 21 September 2026).
--
-- She asked for mood, and corrected me within the minute: "Not just mood,
-- energy levels, etc". The "etc" is the important word.
--
-- ONE ROW PER MEASURE PER DAY, rather than a column per measure. Mood and
-- energy are the two that ship; focus, stress, appetite or anything else she
-- names later needs no migration, no deploy and no change to the report that
-- reads them. A table whose shape has to change every time somebody wants to
-- track one more thing about themselves is the wrong table for an app whose
-- whole argument is that a person knows what matters to them.
--
-- A NUMBER UNDERNEATH, A WORD ON TOP. The value is 1 to 5 so two measures can
-- sit in the same column and a fortnight of them can be put beside a fortnight
-- of drinks - which is the entire point:
--
--   "catching things like low mood always 2 days after cocktails eg, could
--   genuinely be unknown to a user and needs something to check if Ai says it."
--
-- What she SEES is never the number. Five ordered words per measure, because a
-- 1-to-10 score invites a precision nobody possesses and reads as a grade.

create table if not exists public.daily_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  measure text not null,
  value smallint not null check (value between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, measure)
);

alter table public.daily_ratings enable row level security;

create policy "daily_ratings are hers" on public.daily_ratings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists daily_ratings_user_day on public.daily_ratings (user_id, day desc);
create index if not exists daily_ratings_user_measure on public.daily_ratings (user_id, measure, day desc);
