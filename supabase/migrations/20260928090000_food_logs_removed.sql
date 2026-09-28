-- WHERE A DELETED FOOD ROW GOES BEFORE IT IS DELETED (2026-09-28).
-- Applied via the management API the same day. Her food log is a record of her
-- own body and nothing leaves it without a copy kept first.
create table if not exists public.food_logs_removed (
  id uuid primary key,
  user_id uuid not null,
  happened_at timestamptz,
  raw_text text,
  kcal numeric,
  protein_g numeric,
  full_row jsonb not null,
  items jsonb not null default '[]'::jsonb,
  removed_at timestamptz not null default now(),
  removed_because text not null
);

alter table public.food_logs_removed enable row level security;

drop policy if exists "own removed food rows are readable" on public.food_logs_removed;
create policy "own removed food rows are readable"
  on public.food_logs_removed for select using (auth.uid() = user_id);

create index if not exists food_logs_removed_user_idx
  on public.food_logs_removed (user_id, removed_at desc);
