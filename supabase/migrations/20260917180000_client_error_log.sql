-- Where the phone writes a failure it cannot explain on screen.
--
-- The voice note failed on device with nothing but a generic line, and three
-- rounds of screenshots did not settle which stage broke. A phone log we cannot
-- read is not evidence. This is small, append-only and scoped to the person's
-- own rows.
create table if not exists client_error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_error_log_user_time_idx on client_error_log (user_id, created_at desc);

alter table client_error_log enable row level security;

drop policy if exists "insert_own" on client_error_log;
create policy "insert_own" on client_error_log for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "read_own" on client_error_log;
create policy "read_own" on client_error_log for select to authenticated
  using (auth.uid() = user_id);
