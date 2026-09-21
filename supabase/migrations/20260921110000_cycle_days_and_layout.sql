-- THE CYCLE PAGE (Ruth, 21 September 2026, from her ChatGPT mock).
--
-- "I think we need to add the cycle tracker to the Log page afterall. It needs
-- to be visually accessible to a user to build pattern understanding and so it
-- makes sense when the ai starts making observations there's something to check
-- against."
--
-- TWO TABLES, BECAUSE THERE ARE TWO KINDS OF FACT. `cycle_events` already
-- records the moments that define a cycle - a period starting, ending - and is
-- what every phase calculation reads. `cycle_days` is what a day FELT like:
-- flow, symptoms, ovulation signs, notes. Keeping them apart means the phase
-- maths never has to pick its way around a day somebody logged a headache on.
--
-- ONE ROW PER DAY, replaced rather than appended. A day has one description,
-- and editing it should change it rather than leave two.

create table if not exists public.cycle_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  flow text,
  symptoms text[] not null default '{}',
  ovulation text[] not null default '{}',
  mucus text,
  notes text,
  temperature_c numeric(4,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.cycle_days enable row level security;

create policy "cycle_days are hers" on public.cycle_days
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists cycle_days_user_day on public.cycle_days (user_id, day desc);

alter table public.user_profile
  add column if not exists cycle_layout jsonb;
