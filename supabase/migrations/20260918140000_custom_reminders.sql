-- Reminders somebody asked for in their own words.
--
-- "Remind me to drink water at 9am" was answered twice with "I can't do that"
-- (Ruth, 18 September 2026). The app had daily prompts to LOG, at fixed times,
-- and nothing else. This is the other kind: her words, her time.
--
-- WHAT IS STORED IS WHAT SHE SAID. `label` is the reminder in her phrasing, and
-- it is what the notification says back to her - not a category, not a type. The
-- app never invents a reason to nudge somebody; it only ever repeats one they
-- asked for.
--
-- Scheduled locally on the device (there is no server scheduler in this project),
-- so this table is the record and the phone reads it at launch.
create table if not exists custom_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 120),
  at_time text not null check (at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  weekday smallint check (weekday between 0 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  source text not null default 'chat'
);

create index if not exists custom_reminders_user_active_idx
  on custom_reminders (user_id, active, at_time);

alter table custom_reminders enable row level security;

drop policy if exists "manage_own" on custom_reminders;
create policy "manage_own" on custom_reminders for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
