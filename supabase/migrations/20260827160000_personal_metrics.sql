-- Everything else someone tracks about their body, split from the scale table.
--
-- WHY SPLIT (Ruth's decision, 2026-08-27). Scale metrics and everything else
-- come from genuinely different sources and different habits: someone can stop
-- using a scale and keep tape-measuring, or the reverse. One combined table
-- would leave permanent empty cells for whichever source they had stopped -
-- which is exactly what the split avoids.
--
-- WHY NOT body_measurement_custom_metrics, WHICH ALREADY EXISTED. Its
-- metric_name/metric_value/unit triple was the right idea, but its parentage was
-- wrong: `measurement_id uuid NOT NULL references body_measurements(id)` made
-- every entry hang off a SCALE reading, so a waist measured on a day you did not
-- weigh yourself was impossible to store. That is precisely the assumption the
-- split overturns. It also had no user_id (RLS came from the parent join, which
-- cannot survive losing the parent) and no measured_at (so no backdating). It
-- held 0 rows and had 0 code references, so it is dropped rather than altered -
-- its name asserts a relationship that no longer exists, and a misleading name
-- outlives whoever remembers why.
drop table if exists body_measurement_custom_metrics;

create table personal_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Its own timestamp, independent of any scale reading, so "my waist was 70 on
  -- Monday" lands on Monday.
  measured_at timestamptz not null default now(),
  -- Open by design (Part Eight: "any user can track any personally meaningful
  -- point, not limited to a preset menu"). Normalised at log time against the
  -- names this person already uses, so "waist", "my waist" and "Waist" stay ONE
  -- metric rather than three rows in the table.
  metric_name text not null,
  value numeric not null,
  -- Paired readings. Blood pressure is two numbers and is one thing: storing it
  -- as two metrics would make it two rows in a table where it is obviously one,
  -- and storing "120/80" as text would kill trending. Null for everything else.
  value_secondary numeric,
  -- What they actually said (cm, in, bpm, mmHg). NOT normalised to a canonical
  -- unit: weight could be, because its unit space is known, but an unbounded
  -- metric space has no equivalent. Stated honestly rather than silently guessed.
  unit text,
  raw_input text,
  created_at timestamptz not null default now()
);

-- The view is "latest per metric, newest first"; the ordering of the metrics
-- themselves is by when each was FIRST logged, which is min(created_at) per name.
create index personal_metrics_user_measured_idx
  on personal_metrics (user_id, measured_at desc);
create index personal_metrics_user_name_idx
  on personal_metrics (user_id, metric_name);

alter table personal_metrics enable row level security;
create policy "manage_own" on personal_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
