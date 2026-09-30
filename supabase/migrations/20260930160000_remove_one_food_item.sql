-- REMOVING ONE ITEM FROM A MEAL, WITHOUT LEAVING THE MEAL'S TOTALS LYING.
--
-- Ruth, 30 September 2026, item 2d: per-item delete and edit on the food item
-- view, keeping "Delete this meal".
--
-- The card has always listed the items behind a meal and let her delete the
-- WHOLE meal. Deleting one item is the thing she has been asking for since the
-- peanut butter turn, and it cannot be a plain `delete from food_items`,
-- because every figure she is shown - the row, the day, the week, the targets -
-- comes from food_logs, not from the items. Delete the chia and the log still
-- says it was there.
--
-- WHY A DELTA AND NOT A RECOMPUTE, which is the decision in this file.
--
-- The obvious design is "a log with items equals the sum of its items", and it
-- is wrong here, because on 30 September that invariant did not hold for a
-- quarter of her data: 68 itemised logs, 16 of them disagreeing by more than 5
-- kcal, the worst by 206. And neither side is reliably the honest one -
--
--   "80g fruit salad, 50g chia, oat and low-fat yogurt pudding" says 273 kcal
--   and its items say 473. 50g of chia alone is about 240, so the LOG is low.
--
--   "80g chicken breast, 80g salad, 80g beans, 60g feta" says 395 and its items
--   say 531, but among those items is "Salad 80g = 133 kcal", which leafy salad
--   is not. There the ITEM is wrong.
--
-- So recomputing would rewrite sixteen of her meals in an uncertain direction
-- the first time she touched any item on them, and she never asked for that.
-- Subtracting exactly what the deleted item claimed changes the total by the
-- amount attributable to the thing she removed and leaves every figure she did
-- not touch alone. The pre-existing disagreement is a separate question, and it
-- is hers to answer, not something to silently tidy under cover of a delete.
--
-- WHY A FUNCTION AND NOT A TRIGGER. A trigger cannot tell these two apart:
--
--   the parse writing a new meal - which sets food_logs' totals ITSELF and then
--   inserts the items, so adding them again would double every meal;
--
--   a correction replacing a meal's items, which deletes them all and
--   re-inserts (app/lib/food-logging.ts), so a delete trigger would drive the
--   log to zero mid-flight.
--
-- One function, one transaction, and the subtraction cannot be skipped by
-- forgetting the second statement. SECURITY INVOKER, so row-level security
-- decides whose item this is exactly as it does everywhere else - the function
-- adds no reach that the caller did not already have.

-- ---------------------------------------------------------------------------
-- DRIFT, FIXED IN PASSING. food_items carries saturated_fat_g, sugar_g and
-- fibre_g in the live database and app/lib/food-logging.ts has been writing all
-- three since 24 September, but no checked-in migration ever added them: the
-- three-macro migration of that date altered food_composition and food_cache
-- and missed this table. A database rebuilt from this folder would have failed
-- every itemised insert, silently, because that insert's error is logged and
-- swallowed as non-fatal. `if not exists` makes this a no-op against the live
-- project and correct against a fresh one.
alter table public.food_items
  add column if not exists saturated_fat_g numeric,
  add column if not exists sugar_g numeric,
  add column if not exists fibre_g numeric;

-- ---------------------------------------------------------------------------

create or replace function public.food_item_remove(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.food_items;
begin
  -- RLS decides whether this row is visible. If it is not, there is nothing to
  -- delete and nothing to subtract, and the function returns quietly rather
  -- than reporting on the existence of somebody else's row.
  select * into v_item from public.food_items where id = p_item_id;
  if not found then
    return;
  end if;

  delete from public.food_items where id = p_item_id;

  -- A NULL TOTAL STAYS NULL. Null means "not known", and turning it into 0 by
  -- subtraction would state a figure nobody ever measured - the same class of
  -- mistake as reading an empty record as an empty day. Only a figure that
  -- exists is reduced, and never below zero.
  update public.food_logs fl
  set
    kcal = case when fl.kcal is null then null
                else greatest(fl.kcal - coalesce(v_item.kcal, 0), 0) end,
    protein_g = case when fl.protein_g is null then null
                     else greatest(fl.protein_g - coalesce(v_item.protein_g, 0), 0) end,
    carbs_g = case when fl.carbs_g is null then null
                   else greatest(fl.carbs_g - coalesce(v_item.carbs_g, 0), 0) end,
    fat_g = case when fl.fat_g is null then null
                 else greatest(fl.fat_g - coalesce(v_item.fat_g, 0), 0) end,
    saturated_fat_g = case when fl.saturated_fat_g is null then null
                           else greatest(fl.saturated_fat_g - coalesce(v_item.saturated_fat_g, 0), 0) end,
    sugar_g = case when fl.sugar_g is null then null
                   else greatest(fl.sugar_g - coalesce(v_item.sugar_g, 0), 0) end,
    fibre_g = case when fl.fibre_g is null then null
                   else greatest(fl.fibre_g - coalesce(v_item.fibre_g, 0), 0) end,
    sodium_mg = case when fl.sodium_mg is null then null
                     else greatest(fl.sodium_mg - coalesce(v_item.sodium_mg, 0), 0) end
  where fl.id = v_item.food_log_id;
end;
$$;

comment on function public.food_item_remove(uuid) is
  'Delete one food_items row and subtract its macros from its parent food_logs row, in one transaction. Subtracts a delta rather than recomputing the parent from its items - see the migration that created this function for why.';

-- Reversible: drop function public.food_item_remove(uuid);
