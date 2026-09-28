-- WHERE A DELETED READING GOES BEFORE IT IS DELETED (2026-09-28).
-- Applied via the management API the same day. On 24 September readings were
-- hard-deleted before any archive existed and re-entered rounded from memory,
-- which made that day's record less accurate than the gap would have been.
create table if not exists public.body_measurements_removed (
  id uuid primary key,
  user_id uuid not null,
  measured_at timestamptz,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_kg numeric,
  full_row jsonb not null,
  removed_at timestamptz not null default now(),
  removed_because text not null
);

alter table public.body_measurements_removed enable row level security;

drop policy if exists "own removed readings are readable" on public.body_measurements_removed;
create policy "own removed readings are readable"
  on public.body_measurements_removed for select using (auth.uid() = user_id);

create index if not exists body_measurements_removed_user_idx
  on public.body_measurements_removed (user_id, removed_at desc);
