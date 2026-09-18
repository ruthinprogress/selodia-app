-- McCance and Widdowson (CoFID), the UK government's official food composition
-- table, published by UKHSA. 2,886 foods, measured, per 100g.
--
-- REFERENCE DATA, NOT USER DATA. Identical for everyone, so it is not
-- RLS-scoped to an owner: every signed-in person may read it and nobody may
-- write it from the app. It changes when a new edition is published, through
-- scripts/import-cofid.mjs and scripts/load-cofid.mjs.
--
-- WHY IT LEADS THE PRODUCT API (measured 2026-09-18). Open Food Facts answered
-- "100g cheddar" with "Mature Cheddar & Chive", 469 kcal and 6.9g protein. This
-- table answers it with "Cheese, Cheddar, English", 416 kcal and 25.4g. One is a
-- branded product sharing a word; the other is the food.
--
-- Contains public sector information licensed under the Open Government
-- Licence v3.0.

create table if not exists public.food_composition (
  code text primary key,
  name text not null,
  food_group text,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  sodium_mg numeric,
  -- Lowercased name, for matching. A column rather than a computed expression
  -- so it can carry the trigram index.
  search_name text not null,
  source text not null default 'mcwiddowson',
  edition text not null default 'CoFID 2021'
);

create extension if not exists pg_trgm;

create index if not exists food_composition_search_trgm
  on public.food_composition using gin (search_name gin_trgm_ops);

alter table public.food_composition enable row level security;

create policy "food_composition_read_all" on public.food_composition
  for select to authenticated using (true);

-- Candidate foods for a description, by trigram similarity.
--
-- Returns CANDIDATES, not an answer: CoFID inverts its names - "Cheese,
-- Cheddar, English" - so similarity alone ranks "cheese" above "cheddar" for a
-- query of "cheddar". The caller scores the shortlist on whole words and may
-- still decide none of them is the food. See app/lib/food-lookup/composition.ts.
create or replace function public.match_food_composition(q text, n integer default 15)
returns table (
  code text,
  name text,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  sodium_mg numeric,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.code, c.name, c.kcal, c.protein_g, c.fat_g, c.carbs_g, c.sodium_mg,
         similarity(c.search_name, lower(q)) as similarity
  from public.food_composition c
  where c.search_name % lower(q)
  order by similarity(c.search_name, lower(q)) desc
  limit least(greatest(n, 1), 50);
$$;
