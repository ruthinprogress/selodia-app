-- Health Context (mobile/SELODIA_SPEC.md, Part Twelve): optional, status-based
-- health markers + diagnosed conditions, captured at onboarding and injected
-- into AI food guidance. Deliberately STATUS-based, never raw lab values: the
-- app never computes a clinical threshold, it only ever acts on the status the
-- user reports (what their GP/results told them). 1:1 with the user, same
-- user_id-as-PK + per-user RLS shape as user_profile.

create table health_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Markers: each holds a user-reported status, never a numeric value. Shared
  -- enum covers every marker (elevated matters for LDL/cholesterol/glucose,
  -- low matters for HDL/ferritin, thyroid can go either way).
  ldl_status text check (ldl_status in ('normal', 'elevated', 'low', 'borderline', 'unsure')),
  hdl_status text check (hdl_status in ('normal', 'elevated', 'low', 'borderline', 'unsure')),
  cholesterol_status text check (cholesterol_status in ('normal', 'elevated', 'low', 'borderline', 'unsure')),
  glucose_status text check (glucose_status in ('normal', 'elevated', 'low', 'borderline', 'unsure')),
  ferritin_status text check (ferritin_status in ('normal', 'elevated', 'low', 'borderline', 'unsure')),
  thyroid_status text check (thyroid_status in ('normal', 'elevated', 'low', 'borderline', 'unsure')),

  -- Diagnosed conditions: fixed checklist booleans + free-text "other", so the
  -- deterministic prompt mapping has known keys to match on.
  condition_pcos boolean not null default false,
  condition_ibs boolean not null default false,
  condition_hypothyroid boolean not null default false,
  condition_t2d boolean not null default false,
  conditions_other text,

  -- Explicit acknowledgment captured specifically at the health-context step
  -- (special-category data under UK data protection law), distinct from the
  -- general onboarding consent. Null until the person acknowledges.
  acknowledged_at timestamptz
);

alter table health_context enable row level security;
create policy "manage_own" on health_context for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
