-- Whole-day tracker totals, which are NOT sessions.
--
-- WHY THIS TABLE EXISTS. A Samsung Health daily summary screenshot was being
-- filed into activity_logs as a single activity: activity_type "Daily Summary",
-- kcal_burned = the whole day's burn. That is a category error, not a rounding
-- one. 1063 kcal across a day of walking about is not a 1063 kcal session, and
-- once it is a row in activity_logs everything downstream reads it as one --
-- ask-unflump narrated it back as a session, the Activity list showed it beside
-- real workouts. The screenshot was always classified correctly; it was then
-- deliberately packaged as an activity anyway. Separate table, separate meaning.
--
-- NOT TO BE CONFUSED WITH `daily_summaries` (Part Nine), which is the day's
-- narrative context and mediating factor. Same word, unrelated thing. This one
-- is numbers off a tracker; that one is what kind of day it was.
--
-- ONE ROW PER USER PER DAY. Re-photographing the same day's screen -- easily
-- done, the figures climb all day -- must correct the day rather than stack a
-- second copy of it. The unique constraint is what makes the upsert in
-- parse-activity safe.
--
-- CONTEXT-ONLY, DELIBERATELY (decision, 2026-09-04). These figures are visible
-- to Selodia and on the Activity screen. They do NOT feed the calorie target:
-- TDEE stays anchored to the onboarding activity multiplier. Wiring an observed
-- daily burn into the target would move someone's calorie goal day to day on
-- the word of a watch, which is a real product decision and is parked, not
-- forgotten.
create table daily_activity_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps integer check (steps is null or steps >= 0),
  kcal_burned numeric check (kcal_burned is null or kcal_burned >= 0),
  active_minutes numeric check (active_minutes is null or active_minutes >= 0),
  distance_km numeric check (distance_km is null or distance_km >= 0),
  source text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index daily_activity_summaries_user_date_idx
  on daily_activity_summaries (user_id, date desc);

alter table daily_activity_summaries enable row level security;
create policy "manage_own" on daily_activity_summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The two rows that were already mis-filed (2026-07-31 and 2026-09-04). Moved,
-- not recreated: steps and distance are recovered from the notes text where the
-- parse put them, and are simply null where it did not. The insert runs before
-- the delete, so a failure here leaves the original rows untouched.
insert into daily_activity_summaries
  (user_id, date, steps, kcal_burned, active_minutes, distance_km, source, created_at)
select
  user_id,
  (happened_at at time zone 'UTC')::date,
  nullif(regexp_replace(coalesce(substring(notes from '([0-9][0-9,]*)\s*steps'), ''), ',', '', 'g'), '')::integer,
  kcal_burned,
  duration_min,
  nullif(substring(notes from '([0-9]+\.?[0-9]*)\s*km'), '')::numeric,
  coalesce(source, 'Samsung daily summary'),
  created_at
from activity_logs
where source ilike '%daily summary%' or activity_type ilike '%daily summary%'
on conflict (user_id, date) do nothing;

delete from activity_logs
where source ilike '%daily summary%' or activity_type ilike '%daily summary%';
