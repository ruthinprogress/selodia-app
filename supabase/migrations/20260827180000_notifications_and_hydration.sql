-- Push delivery (Part Fourteen) and hydration (Part Twelve, build item 31).
--
-- One migration because both land in the same pass before an EAS build, not
-- because they are related.

-- Where to send, and what this person actually agreed to.
--
-- One row per DEVICE, not per user: the same account on a phone and a tablet is
-- two tokens, and a token is rotated by the OS rather than being stable.
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

-- The reminder settings, per person.
--
-- Permission is asked AT THE FIRST LOG, never as a generic upfront prompt (Part
-- Fourteen), so absence of a row means "not asked yet" - which is deliberately
-- distinct from a row with enabled=false, meaning "asked, and they said no".
-- Collapsing those two would mean re-asking someone who already declined.
create table reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  -- Local wall-clock times, "HH:MM", in the person's own day. Stored as text
  -- rather than time-of-day so the default "2pm and 8pm" and a custom set are
  -- the same shape, and an empty array is a valid "none".
  times text[] not null default array['14:00','20:00'],
  asked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hydration. Its own table rather than a column on food_logs: water is logged in
-- its own rhythm (many small entries a day), and folding it into food would make
-- every glass an entry in the food breakdown, which it is not.
create table hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  happened_at timestamptz not null default now(),
  ml numeric not null,
  raw_input text,
  created_at timestamptz not null default now()
);
create index hydration_logs_user_happened_idx on hydration_logs (user_id, happened_at desc);

alter table push_tokens enable row level security;
alter table reminder_settings enable row level security;
alter table hydration_logs enable row level security;

create policy "manage_own" on push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on reminder_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manage_own" on hydration_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
