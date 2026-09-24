-- The three macros the Food log can now show, from the table that measured them.
--
-- WHY (Ruth, 24 September 2026). "What I track" lets someone turn on saturated
-- fat, sugar and fibre. Until now the only source for those three was the
-- model's own estimate, because food_composition - the UK government's measured
-- table - was imported without them. The spreadsheet has had all three columns
-- the whole time; scripts/import-cofid.mjs simply read past them.
--
-- FIBRE IS TWO DIFFERENT MEASUREMENTS AND THEY ARE NOT INTERCHANGEABLE. CoFID
-- carries both AOAC fibre (the international method, what food labels in the
-- shops report) and NSP (Englyst non-starch polysaccharide, the older UK
-- method). AOAC counts resistant starch and lignin that NSP does not, so the
-- same food reads roughly a third higher under AOAC. Coverage forces the issue:
-- AOAC has 1,548 of 2,887 foods, NSP has 2,538, and 247 have neither.
--
-- So fibre_g takes AOAC where it exists and NSP where it does not, and
-- fibre_basis records which one it is. Mixing two methods silently into one
-- column would be a number that means different things on different rows with
-- nothing to say so - and a total across a day would quietly add them together.
-- This way the column is usable and the fact is still in the data.
--
-- Contains public sector information licensed under the Open Government
-- Licence v3.0.

alter table public.food_composition
  add column if not exists saturated_fat_g numeric,
  add column if not exists sugar_g numeric,
  add column if not exists fibre_g numeric,
  add column if not exists fibre_basis text;

alter table public.food_composition
  drop constraint if exists food_composition_fibre_basis_check;

alter table public.food_composition
  add constraint food_composition_fibre_basis_check
  check (fibre_basis is null or fibre_basis in ('AOAC', 'NSP'));

-- The shortlist has to carry them too, or the matcher gets a row with the three
-- columns missing and the caller has nothing to write. Same body as before with
-- three more selects; the ordering and the trigram filter are untouched.
--
-- Dropped rather than replaced: Postgres refuses "create or replace" when the
-- OUT columns change, and three new columns is exactly that.
drop function if exists public.match_food_composition(text, integer);

create function public.match_food_composition(q text, n integer default 15)
returns table (
  code text,
  name text,
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  sodium_mg numeric,
  saturated_fat_g numeric,
  sugar_g numeric,
  fibre_g numeric,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.code, c.name, c.kcal, c.protein_g, c.fat_g, c.carbs_g, c.sodium_mg,
         c.saturated_fat_g, c.sugar_g, c.fibre_g,
         similarity(c.search_name, lower(q)) as similarity
  from public.food_composition c
  where c.search_name % lower(q)
  order by similarity(c.search_name, lower(q)) desc
  limit least(greatest(n, 1), 50);
$$;
