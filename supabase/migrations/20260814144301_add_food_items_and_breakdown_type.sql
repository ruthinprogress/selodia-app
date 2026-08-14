-- Itemized food breakdown (Part Five, build item 11 slice 1): store the component
-- items behind a food log, plus how the log was broken down. food_items mirrors
-- the body_measurement_custom_metrics child-table pattern but carries a direct
-- user_id for per-user RLS, matching every other table.
alter table food_logs add column breakdown_type text
  check (breakdown_type in ('simple', 'multi_component', 'consistent_ratio', 'high_variability'));

create table food_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null references food_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity text,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  sodium_mg numeric,
  created_at timestamptz not null default now()
);
create index food_items_food_log_id_idx on food_items (food_log_id);
create index food_items_user_id_idx on food_items (user_id);
alter table food_items enable row level security;
create policy "manage_own" on food_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
