-- FREE SUGARS, BECAUSE TOTAL SUGAR CANNOT BE COMPARED TO ANYTHING.
--
-- Ruth, 23 October 2026, on being told the sugar tile would have no colour:
-- "if there's nothing for cakes and biscuits that's surely a bit silly. i could
-- eat my tddee in cake and biscuits ane look like i was healthy on the app."
--
-- SHE IS RIGHT, AND MY ANSWER HAD STOPPED ONE STEP SHORT. The published figure
-- is 30g of FREE sugars a day; the log counted ALL sugar, including what is in
-- whole fruit and milk. The two are not comparable, so colouring the total
-- against that limit would have marked almost everybody "higher" for eating
-- fruit - which is why the tile was going to stay grey.
--
-- But grey meant the most conspicuous thing on a cake day said nothing, and
-- silence on the obvious signal reads as the app not noticing. The fix is not a
-- cleverer comparison. It is storing the right number.
--
-- The parser already estimates ten nutrients per item. Free sugars is the
-- eleventh, and it is the one that separates a biscuit from an apple - which is
-- also the single most useful distinction this app could teach anybody about
-- what they eat.
--
-- WHAT THE REST OF THE GRID ALREADY SHOWED, for the record, because the app was
-- not silent on a cake day even before this: protein low, fibre low, saturated
-- fat above the guideline, calcium and iron low. Five terracotta tiles. The
-- aggregate was right; the obvious one was missing.

alter table food_logs  add column if not exists free_sugar_g numeric;
alter table food_items add column if not exists free_sugar_g numeric;

comment on column food_logs.free_sugar_g is
  'Added and free sugars only, not the sugar naturally in whole fruit, vegetables and milk. This is the figure the NHS 30g guidance is about; sugar_g is the total and is not comparable to it.';
comment on column food_items.free_sugar_g is
  'Added and free sugars only, not the sugar naturally in whole fruit, vegetables and milk. This is the figure the NHS 30g guidance is about; sugar_g is the total and is not comparable to it.';
