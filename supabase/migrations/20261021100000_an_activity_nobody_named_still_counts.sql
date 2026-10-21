-- A NAME IS CLASSIFIED ONCE, FOR EVERYBODY.
--
-- The weighting table holds thirty-one broad activity types. Anything else -
-- "Pull-up practice", "Rocket Yoga Strength + Meditation", "star jumps" - got
-- six nulls and counted for nothing in the Health Flower, from every path.
-- The comments in activity-logging.ts describe a classifier that judges them;
-- it was never built, so 14 of Ruth's 48 logged sessions were invisible to the
-- drawing that is meant to show what her movement is protecting.
--
-- THIS IS A DICTIONARY, NOT USER DATA. The key is the activity name as typed,
-- lowercased. It holds no user_id and no row ever points back at a person, so
-- "pull-up practice" is paid for once and answers for everybody who logs it
-- afterwards. That is also why it is readable by any signed-in user and
-- writable by none of them: the server writes it with the service role.
create table if not exists public.activity_coverage (
  name_key text primary key,
  -- The six, on the same 0-100 scale as the weighting table. Not null: a row
  -- here means classified, and a half-classified row is worse than none at
  -- all because the flower would count what it found and read the rest as
  -- zero. See health-flower.ts on why null is not zero.
  cover_strength smallint not null check (cover_strength between 0 and 100),
  cover_cardio smallint not null check (cover_cardio between 0 and 100),
  cover_flexibility smallint not null check (cover_flexibility between 0 and 100),
  cover_balance smallint not null check (cover_balance between 0 and 100),
  cover_bone smallint not null check (cover_bone between 0 and 100),
  cover_recovery smallint not null check (cover_recovery between 0 and 100),
  -- What answered, so a later change of model can be told from a later change
  -- of definition when somebody asks why a number moved.
  classified_by text,
  created_at timestamptz not null default now()
);

alter table public.activity_coverage enable row level security;

-- READ BY ANYONE SIGNED IN, WRITTEN BY NOBODY. The dictionary is useful to the
-- phone (it can skip a round trip for a name already known) and there is
-- nothing private in it. Writes come from the server with the service role,
-- which bypasses this.
drop policy if exists "activity coverage is readable" on public.activity_coverage;
create policy "activity coverage is readable"
  on public.activity_coverage for select
  to authenticated
  using (true);
