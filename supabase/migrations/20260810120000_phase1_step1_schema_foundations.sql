-- Phase 1, step 1: core schema foundations (mobile/UNFLUMP_SPEC.md, Part Sixteen)

-- user_profile: structured, typed fields (distinct from the freeform
-- category/content user_context table used by [REMEMBER])
create table user_profile (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Fat Focus / Muscle Focus (Part Eight). Qualitative targets reuse the
  -- anchor-goal data already stored in user_context rather than duplicating it.
  fat_focus_state text not null default 'maintain'
    check (fat_focus_state in ('reduce', 'maintain', 'increase')),
  fat_focus_target_type text
    check (fat_focus_target_type in ('quantitative', 'qualitative')),
  fat_focus_target_value numeric,

  muscle_focus_state text not null default 'maintain'
    check (muscle_focus_state in ('reduce', 'maintain', 'increase')),
  muscle_focus_target_type text
    check (muscle_focus_target_type in ('quantitative', 'qualitative')),
  muscle_focus_target_value numeric,

  -- Equipment status (Part Eight) — field names taken directly from spec
  has_scales boolean not null default false,
  has_steps_tracker boolean not null default false,

  -- Pause mechanism (Part Eleven): nullable = not paused; a timestamp
  -- records when that area entered lite mode, so duration is derivable.
  food_paused_at timestamptz,
  body_paused_at timestamptz,
  activity_paused_at timestamptz,

  -- Onboarding (Part Seven)
  onboarding_step text not null default 'not_started',
  deferred_topics jsonb not null default '[]'::jsonb
);

-- cycle_events (Part Thirteen): "(date, type)" per spec, kept minimal
create table cycle_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_date date not null,
  event_type text not null
);
create index cycle_events_event_date_idx on cycle_events (event_date);

-- Custom-metric generalization for body_measurements (Part Eight): a side
-- table rather than a JSONB column, so a given custom metric name can be
-- queried/trended across readings the same way the fixed fields already are.
create table body_measurement_custom_metrics (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references body_measurements(id) on delete cascade,
  metric_name text not null,
  metric_value numeric not null,
  unit text,
  created_at timestamptz not null default now()
);
create index body_measurement_custom_metrics_measurement_id_idx
  on body_measurement_custom_metrics (measurement_id);
create index body_measurement_custom_metrics_metric_name_idx
  on body_measurement_custom_metrics (metric_name);
