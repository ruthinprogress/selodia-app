-- Step 5 RLS/backfill follow-up, piece 1: user_id + RLS across all 8 tables

-- Add user_id to the 6 directly-owned tables (nullable for now — NOT NULL
-- gets added after backfill, since these rows are currently orphaned)
alter table body_measurements add column user_id uuid references auth.users(id) on delete cascade;
alter table activity_logs add column user_id uuid references auth.users(id) on delete cascade;
alter table food_logs add column user_id uuid references auth.users(id) on delete cascade;
alter table user_context add column user_id uuid references auth.users(id) on delete cascade;
alter table chat_messages add column user_id uuid references auth.users(id) on delete cascade;
alter table cycle_events add column user_id uuid references auth.users(id) on delete cascade;

create index body_measurements_user_id_idx on body_measurements (user_id);
create index activity_logs_user_id_idx on activity_logs (user_id);
create index food_logs_user_id_idx on food_logs (user_id);
create index user_context_user_id_idx on user_context (user_id);
create index chat_messages_user_id_idx on chat_messages (user_id);
create index cycle_events_user_id_idx on cycle_events (user_id);

-- user_profile: redesign PK (0 rows, safe to restructure) — user_id becomes
-- the primary key itself rather than a separate column
alter table user_profile drop constraint user_profile_pkey;
alter table user_profile drop column id;
alter table user_profile add column user_id uuid primary key references auth.users(id) on delete cascade;

-- Enable RLS
alter table body_measurements enable row level security;
alter table activity_logs enable row level security;
alter table food_logs enable row level security;
alter table user_context enable row level security;
alter table chat_messages enable row level security;
alter table cycle_events enable row level security;
alter table user_profile enable row level security;
alter table body_measurement_custom_metrics enable row level security;

-- One policy per table, own-rows-only for every operation
create policy "manage_own" on body_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on activity_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on food_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on user_context for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on cycle_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on user_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- body_measurement_custom_metrics has no direct user - scoped via the parent
-- row's user_id instead of a redundant denormalized column
create policy "manage_own" on body_measurement_custom_metrics for all
  using (exists (select 1 from body_measurements bm where bm.id = measurement_id and bm.user_id = auth.uid()))
  with check (exists (select 1 from body_measurements bm where bm.id = measurement_id and bm.user_id = auth.uid()));
