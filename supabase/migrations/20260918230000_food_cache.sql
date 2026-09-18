-- The personal food cache: tier 1 of the hybrid food lookup (Part Eleven).
--
-- WHY IT EXISTS. Every food log routes through the Anthropic API regardless of
-- how ordinary the food is. A banana logged fifty times costs fifty calls and
-- the answer never changes.
--
-- WHAT IS STORED IS THE WHOLE DESCRIPTION, NOT AN INGREDIENT. The key is the
-- person's own words for the thing they ate, normalised - "73g boiled new
-- potatoes" - and the macros are the ones that were stored for it. That is a
-- deliberate departure from the spec's routing note, which says to strip
-- quantities when normalising: stripping them makes "73g potatoes" and "200g
-- potatoes" the same row, and the second person to log the second one gets the
-- first one's calories. A cache that is quietly wrong is worse than no cache.
--
-- PER USER, ALWAYS. The same words mean different things to different people -
-- "my usual porridge" is not a public fact - and one person's confirmed estimate
-- must never become another's. RLS enforces it; the unique index is per user for
-- the same reason.
--
-- `source` RECORDS WHERE THE NUMBERS CAME FROM ORIGINALLY, never 'cache': the
-- tier that answered is not a property of the data, and knowing a row came from
-- Open Food Facts rather than from a model is what makes it auditable later.

create table if not exists public.food_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Normalised: lowercase, punctuation collapsed, quantities KEPT. See above.
  food_name text not null,

  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  sodium_mg numeric,

  source text not null check (source in ('open_food_facts', 'mcwiddowson', 'usda', 'llm')),
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),

  log_count integer not null default 1,
  last_used timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint food_cache_unique_per_user unique (user_id, food_name)
);

create index if not exists food_cache_user_last_used_idx
  on public.food_cache (user_id, last_used desc);

alter table public.food_cache enable row level security;

create policy "food_cache_select_own" on public.food_cache
  for select using (auth.uid() = user_id);

create policy "food_cache_insert_own" on public.food_cache
  for insert with check (auth.uid() = user_id);

create policy "food_cache_update_own" on public.food_cache
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "food_cache_delete_own" on public.food_cache
  for delete using (auth.uid() = user_id);
