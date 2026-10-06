-- WHY CHAT KEPT SAYING HER LOG HOLDS CALORIES AND PROTEIN (Ruth, 6 October 2026).
--
-- Third sitting on this fault, and the first one that found it.
--
-- The macro block was built, correct, and in the prompt. A probe against her
-- real account produced 1,610 characters of her own saturated fat, day by day,
-- for a fortnight: 17g on the 5th, 25g on the 4th, 40g on the 1st. The register
-- was fixed last night. She asked again this morning and was told, again,
-- "that's not part of what's logged here, just calories and protein."
--
-- THE BLOCK WAS OUTVOTED BY THE LOG. recentFood selected happened_at, raw_text,
-- kcal and protein_g, and the prompt renders one line per meal from it:
--
--   Sunday: pizza and a glass of red (980kcal, 34g protein)
--
-- Seven days of that is thirty or forty lines, every one of them a meal with
-- exactly two numbers on it, and then one block underneath saying there are six.
-- The model did not disbelieve the block. It believed the evidence, and the
-- evidence was her log.
--
-- SO THE FIX IS NOT ANOTHER INSTRUCTION, because two instructions disagreeing is
-- what produced this. The meal lines carry the macros, the log and the block say
-- the same thing, and there is nothing left to adjudicate.
--
-- WHAT IT COSTS: six columns on a select that was already happening, over a few
-- days of rows. They are on those rows already, written by the same parse that
-- wrote the calories.
--
-- WHAT THE PROMPT SHOWS IS STILL HERS TO DECIDE: route.ts renders only the
-- macros she has switched on in "What I track", so somebody tracking nothing
-- optional sees exactly what they saw before.

do $outer$
declare
  def text;
  oldblock text;
  newblock text := $block$    'recentFood', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select happened_at, raw_text, kcal, protein_g,
               fat_g, saturated_fat_g, carbs_g, sugar_g, fibre_g, sodium_mg
        from food_logs where happened_at >= p_since
        order by happened_at desc
      ) t
    ), '[]'::jsonb),
$block$;
  startpos int;
  endpos int;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;
  if position('saturated_fat_g' in def) > 0 then raise notice 'already present'; return; end if;

  startpos := position($anchor$    'recentFood', coalesce(($anchor$ in def);
  if startpos = 0 then raise exception 'recentFood block not found'; end if;

  endpos := position($after$    'recentActivity'$after$ in def);
  if endpos = 0 or endpos < startpos then raise exception 'cannot find the end of the recentFood block'; end if;

  oldblock := substr(def, startpos, endpos - startpos);
  def := replace(def, oldblock, newblock);
  execute def;
end
$outer$;
