-- The cache has to carry the three macros too, or it loses them on the repeat.
--
-- WHY THIS IS NOT OPTIONAL. Tier 1 answers before tier 2 is consulted. Without
-- these columns, the FIRST time somebody logs "100g cheddar" CoFID supplies
-- saturated fat, sugar and fibre - and the SECOND time the cache answers with
-- the four macros it knows and three nulls. The same food, logged twice, would
-- report different things, and the missing ones would look like foods nobody
-- measured rather than a column that was never written.
--
-- That is the shape of fault this project keeps finding: an absent thing
-- presenting as a working thing. The cache is added at the same commit as the
-- source, so the two can never disagree.

alter table public.food_cache
  add column if not exists saturated_fat_g numeric,
  add column if not exists sugar_g numeric,
  add column if not exists fibre_g numeric;
