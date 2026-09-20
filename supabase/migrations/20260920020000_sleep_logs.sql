-- SLEEP (2026-09-20). Asked for as part of the Log redesign: "Leave out
-- medication and mood. Add sleep."
--
-- KEYED ON THE NIGHT, NOT THE MOMENT. Sleep crosses midnight, so a row keyed
-- on a timestamp would put Friday night's sleep on Saturday for anyone who
-- went to bed after twelve and on Friday for anyone who did not. `night_of` is
-- the date the sleep STARTED, so "Friday night" is one row whichever side of
-- midnight it began, and one night can only be recorded once.
--
-- EVERY FIELD BUT THE NIGHT IS OPTIONAL, because people report sleep in
-- whatever detail they have. "Slept badly" is a real entry with no hours in
-- it, and storing it as a null duration is honest where storing a guess is
-- not. quality is a word rather than a score out of ten: a number invites
-- averaging, and an average of somebody's subjective sleep is not a fact.
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  night_of date not null,
  duration_min integer check (duration_min is null or (duration_min > 0 and duration_min <= 1440)),
  went_to_bed time,
  woke_at time,
  quality text check (quality is null or quality in ('poor', 'broken', 'ok', 'good')),
  awakenings integer check (awakenings is null or (awakenings >= 0 and awakenings <= 30)),
  notes text,
  raw_input text,
  source text not null default 'chat' check (source in ('chat', 'log', 'health')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sleep_logs_one_per_night unique (user_id, night_of)
);

create index if not exists sleep_logs_user_night_idx on public.sleep_logs (user_id, night_of desc);

alter table public.sleep_logs enable row level security;

create policy "sleep_logs_select_own" on public.sleep_logs
  for select using (auth.uid() = user_id);
create policy "sleep_logs_insert_own" on public.sleep_logs
  for insert with check (auth.uid() = user_id);
create policy "sleep_logs_update_own" on public.sleep_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sleep_logs_delete_own" on public.sleep_logs
  for delete using (auth.uid() = user_id);
