-- cycle_days BECOMES daily_observations.
--
-- Ruth, 9 October 2026, on the comment I added half an hour earlier saying
-- "this table is not about cycles, whatever its name says": "it's a bit of a
-- patch job doing it like that."
--
-- She is right. A comment that tells you to ignore the name is an apology for
-- the name, and it only helps somebody who goes looking. The name is read every
-- time; the comment is read once, if ever.
--
-- I HAD ALSO OVERSTATED THE COST to justify the cheap answer. I said a rename
-- meant "every reference touched". The real count: FOUR lines, in ONE file
-- (mobile/src/app/(tabs)/log/cycle.tsx), one RLS policy, two indexes and two
-- constraints - and indexes, constraints and policies all follow a table
-- through a rename automatically.
--
-- WHAT I HAD ACTUALLY MISSED is a different risk, and it is the one that makes
-- this more than an ALTER. Her phone runs a PUBLISHED EAS BUNDLE that reads
-- cycle_days. Renaming the table breaks the Cycle screen on the build already
-- in her hand, until she takes an update. A rename alone would have been the
-- careless version of doing it properly.
--
-- SO THE OLD NAME SURVIVES AS A VIEW. Simple, single-table, no aggregation, so
-- Postgres makes it automatically updatable - the old bundle can still select,
-- insert, update and delete through it. security_invoker = true is the part
-- that matters: without it the view runs as its OWNER and every row in the
-- table becomes visible to everybody, which is how a compatibility shim turns
-- into a data breach. With it, the caller's RLS applies exactly as before.
--
-- The view is temporary. It goes when she is on a build that does not need it,
-- and there is a note in the Open Actionables so it does not become permanent
-- furniture.
--
-- WHY daily_observations. It sits with daily_ratings and daily_summaries, it
-- says what the rows are - things she observed on a day - and it says nothing
-- about cycles. A symptom here belongs to the DAY. Cycle position is derived
-- from the date and her period history and is never stored.

alter table public.cycle_days rename to daily_observations;

-- Tidied so nothing still announces the old idea. These would have kept working
-- untouched; leaving them would mean a table called daily_observations with a
-- primary key called cycle_days_pkey, which is the same confusion one level
-- down.
alter index if exists public.cycle_days_pkey rename to daily_observations_pkey;
alter index if exists public.cycle_days_user_day rename to daily_observations_user_day;
alter table public.daily_observations
  rename constraint cycle_days_user_id_fkey to daily_observations_user_id_fkey;
alter policy "cycle_days are hers" on public.daily_observations
  rename to "daily observations are hers";

comment on table public.daily_observations is
  'What a day was like, one row per person per calendar day: flow, symptoms, '
  'ovulation signs, mucus, notes, temperature. A symptom here belongs to the '
  'DAY and to nothing else. Cycle position is DERIVED by the app from the date '
  'and the person''s period history in cycle_events; it is never stored here '
  'and never declared by the person. There is no such thing as a "cycle '
  'symptom" in this schema - there are symptoms, on days, and a day happens to '
  'sit somewhere in a cycle. Every symptom reaches this table whatever route it '
  'came in by: typed, spoken, or tapped. Called cycle_days until 9 October '
  '2026, which is why the compatibility view of that name exists.';

-- THE SHIM. Drops when she is on a build that reads the new name.
create view public.cycle_days
  with (security_invoker = true)
  as select * from public.daily_observations;

comment on view public.cycle_days is
  'TEMPORARY, created 9 October 2026. The old table name, so an EAS bundle '
  'already on a phone keeps working after the rename to daily_observations. '
  'Auto-updatable because it is a plain single-table select, and '
  'security_invoker means the caller''s RLS applies rather than the view '
  'owner''s. DROP IT once nobody is running a build older than 9 October - '
  'there is a line in the Open Actionables.';

grant select, insert, update, delete on public.cycle_days to authenticated;
