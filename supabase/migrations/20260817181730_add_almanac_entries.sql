-- The Almanac data layer (build item 15). One flexible entries table holding
-- LLM-authored reference documents; anything queryable/time-series lives in
-- separate log tables (the content-vs-logs split, generalized from item 35).
-- kind is OPEN text (Part Two principle 13); category is an emergent field, not
-- a first-class table. content is a JSONB document whose shape is kind-specific
-- (insights store an active condition->expectation rule, per Q2). status is a
-- controlled lifecycle. Distinct from user_context (atomic prompt-facts).
create table almanac_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  category text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'stale', 'pending_reconfirmation')),
  instance_count integer not null default 1 check (instance_count >= 1),
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index almanac_entries_user_id_idx on almanac_entries (user_id);
alter table almanac_entries enable row level security;
create policy "manage_own" on almanac_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
