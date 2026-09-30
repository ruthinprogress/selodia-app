-- CALCIUM, BECAUSE NOTHING IN THE APP HAS EVER RECORDED IT.
--
-- Ruth, 30 September 2026: "Help users consistently meet their calcium needs
-- through gentle, contextual guidance rather than targets, warnings or
-- lectures... The goal is not for users to remember numbers. The goal is for
-- them to naturally build meals that support lifelong bone health."
--
-- Nothing can be shown until something is stored. food_items carries kcal,
-- protein, carbs, fat, sodium, saturated fat, sugar and fibre, and no mineral
-- except sodium. food_composition - the 2,886 CoFID rows - does not carry
-- calcium either; the import took the macros and left the minerals.
--
-- So the figure comes the same way every other one does: the parse estimates it
-- per item, and the meal is the sum of its items. A CoFID column can correct it
-- later where a name matches exactly, the way drinks already are - but CoFID
-- answers under a tenth of what she actually logs, so a lookup alone would
-- leave the feature blank most days.
--
-- NULL IS NOT ZERO, and it matters more here than usual. A day showing 0 mg
-- because nothing was estimated looks like a day she ate no calcium, which is
-- the one thing this feature must never say wrongly.
--
-- Reversible: alter table ... drop column calcium_mg.

alter table public.food_items add column if not exists calcium_mg numeric;
alter table public.food_logs add column if not exists calcium_mg numeric;
alter table public.food_composition add column if not exists calcium_mg numeric;
alter table public.food_cache add column if not exists calcium_mg numeric;

comment on column public.food_items.calcium_mg is
  'Estimated calcium for this item, in mg. Null means nobody worked it out, which is not the same as none.';
