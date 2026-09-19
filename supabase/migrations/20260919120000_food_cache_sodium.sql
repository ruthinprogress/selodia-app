-- The live food_cache was created by the 16 September migration, so the 18
-- September "create table if not exists" never ran and its sodium_mg column
-- never arrived. lib/food-lookup/cache.ts reads and writes sodium_mg, so the
-- switched-off cache would have failed on every call the day it was turned on.
alter table public.food_cache add column if not exists sodium_mg numeric;
