-- Tier 1 of the Hybrid Food Lookup System (SELODIA_SPEC.md).
--
-- Foods this person has logged before, with the estimate they already got. A
-- banana logged fifty times currently costs fifty API calls and the answer never
-- changes; this is where the answer lives instead.
--
-- PERSONAL, NOT SHARED. The cache is keyed on user_id deliberately - it stores
-- how THIS person describes and eats a food, so "my usual coffee" means what it
-- means to them. A shared table would be a food database, which is Tier 2's job
-- and is somebody else's data to maintain.
--
-- SOURCE RECORDS THE ORIGIN, NOT THE TIER. A row written from an Open Food Facts
-- hit keeps source 'open_food_facts' forever, even though every later read of it
-- is a Tier 1 hit. Otherwise the provenance of every figure decays into 'cache'
-- and nothing can say where a number actually came from.
--
-- text + CHECK rather than a Postgres enum, matching activity_logs.source and
-- food_logs.confidence: this project adds values to these lists as it learns, and
-- an enum makes that a migration with a lock rather than an edit.
create table if not exists food_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Normalised at the boundary, not by convention. The spec says lowercase, and
  -- a constraint is the only version of that which survives a careless insert -
  -- a cache keyed on a name is worthless the moment "Banana" and "banana" are
  -- two rows.
  food_name text not null check (food_name = lower(food_name) and length(btrim(food_name)) > 0),

  kcal numeric check (kcal is null or kcal >= 0),
  protein_g numeric check (protein_g is null or protein_g >= 0),
  carbs_g numeric check (carbs_g is null or carbs_g >= 0),
  fat_g numeric check (fat_g is null or fat_g >= 0),

  source text not null check (source in ('cache', 'open_food_facts', 'mcwiddowson', 'usda', 'llm')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),

  -- Increments on every hit. Worth having for its own sake: it is the only
  -- record of which foods someone actually eats repeatedly, which is a different
  -- question from what they logged once.
  log_count integer not null default 1 check (log_count >= 0),
  last_used timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- One row per food per person. A second estimate for the same name is a
  -- correction of the first, never a rival to it.
  unique (user_id, food_name)
);

-- The lookup this table exists for: one person's cache, by name. The unique
-- constraint above already indexes (user_id, food_name), so this adds only the
-- ordering used when reading a person's most-used foods back.
create index if not exists food_cache_user_last_used_idx
  on food_cache (user_id, last_used desc);

alter table food_cache enable row level security;

create policy "manage_own" on food_cache for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
