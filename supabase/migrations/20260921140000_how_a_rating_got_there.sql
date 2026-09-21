-- "EVER SINCE" IS A RANGE, NOT A DAY (Ruth, 21 September 2026).
--
-- Reading back my own example: "'been shattered ever since' actually means
-- that all days, including the period started day were fatigued." Then, a
-- moment later: "Upto Today."
--
-- She is right, and it means one sentence can write a fortnight of rows. Which
-- raises the question this column answers: a day somebody TAPPED on the Feeling
-- screen is a first-hand check-in, and a day filled in from a remark in passing
-- is not. Seven identical rows inferred from one sentence would read in the
-- correlation table as seven independent observations, which is exactly the
-- manufactured evidence that feature exists to guard against.
--
--   tapped  - chosen on the Feeling screen, on purpose, for that day
--   said    - stated in chat about one named day
--   spanned - filled in from a range somebody described in one breath
--
-- Defaulting to 'tapped' is right for every row that already exists: they all
-- came from the screen, because nothing else could write one until today.

alter table public.daily_ratings
  add column if not exists source text not null default 'tapped';

alter table public.daily_ratings
  drop constraint if exists daily_ratings_source_known;

alter table public.daily_ratings
  add constraint daily_ratings_source_known
  check (source in ('tapped', 'said', 'spanned'));
