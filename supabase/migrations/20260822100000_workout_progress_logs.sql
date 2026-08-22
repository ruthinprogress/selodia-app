-- Workout progress logs (build item 35, slice B).
--
-- The plan is a document (an almanac_entries row, slice A); PROGRESS is
-- append-only and lives here. Keeping them apart is the whole point: writing a
-- "current weight" into the plan would overwrite exactly the history that
-- progressive overload depends on being able to read back.
--
-- Both logs are SELF-DESCRIBING. exercise_name is denormalised onto every row,
-- and plan_id is `on delete set null` rather than cascade, so the history still
-- reads "Romanian Deadlift, 60kg, 22 Aug" after the plan is revised,
-- recategorised, or deleted outright. The plan is a document that evolves; the
-- log is the durable record, and the record has to outlive the document.
--
-- Exercises are addressed by (plan_id, exercise_name) rather than by a
-- generated per-exercise id. Because a plan updates IN PLACE on revision, ids
-- would have to be carried forward by matching on name anyway - so they would
-- offer no protection against the one case that actually breaks name-matching
-- (a rename), while adding machinery. Accepted costs: a renamed exercise
-- orphans its history from the plan VIEW (the log stays intact and readable),
-- and two exercises sharing a name inside one plan would merge.

create table workout_weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references almanac_entries(id) on delete set null,
  exercise_name text not null,
  -- NUMERIC, deliberately not an integer. The control is a slider defaulting to
  -- 1kg steps whose value is always freely typeable, precisely because real
  -- equipment lands on odd numbers - Smith machines, oddly-weighted bars,
  -- whatever plates a gym owns. An integer column would silently round those
  -- away and defeat the reason the value is typeable at all.
  weight_kg numeric not null check (weight_kg >= 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index workout_weight_log_lookup_idx
  on workout_weight_log (user_id, plan_id, exercise_name, logged_at desc);

create table workout_completion_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references almanac_entries(id) on delete set null,
  exercise_name text not null,
  -- (plan_id, session_date) is the natural grouping key, so no session id needs
  -- generating. Trade-off accepted: the same plan done twice in one day merges
  -- into a single session.
  session_date date not null default current_date,
  -- Copied from the plan at tick time, same self-describing reasoning as
  -- exercise_name: it also means the session's activity row can be recomputed
  -- from this log alone, without re-reading a plan that may since have changed.
  eccentric_load text check (eccentric_load in ('none', 'low', 'moderate', 'high')),
  intensity text check (intensity in ('light', 'moderate', 'intense')),
  -- The derived activity_logs row for this session. Nullable on purpose: the
  -- tick is the person's own fact, while the activity row is a convenience, so
  -- a failed write must never cost them the completion.
  activity_log_id uuid references activity_logs(id) on delete set null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index workout_completion_log_session_idx
  on workout_completion_log (user_id, plan_id, session_date);

alter table workout_weight_log enable row level security;
create policy "manage_own" on workout_weight_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table workout_completion_log enable row level security;
create policy "manage_own" on workout_completion_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
