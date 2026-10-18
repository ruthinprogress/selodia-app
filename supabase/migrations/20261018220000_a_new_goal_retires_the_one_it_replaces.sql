-- A NEW GOAL RETIRES THE ONE IT REPLACES.
--
-- Ruth, 18 October 2026, with a screenshot of three goals stacked on Plans:
--
--   "Goals get stacked ontop of old ones instead of replacing in Plans Tab.
--    The build for that section was mean to add old ones to a card in
--    Almanac>Goal History"
--
-- BOTH HALVES OF THAT WERE ALREADY BUILT AND NOTHING JOINED THEM.
--
--   mirror_context_goal        a goal stated in chat becomes a user_goals row
--   goal_archived_to_almanac   a goal whose archived_at is set becomes a card
--                              in the Almanac under Goal history
--
-- The second fires on archived_at being set, and the only thing that ever set
-- it was the onboarding goals screen. So a goal stated in CHAT - which is how
-- nearly every goal arrives - inserted a row and retired nothing, forever. She
-- restated one body goal three times in one conversation and finished with
-- three current goals, two of them corrections of the first:
--
--   Goal is 45kg muscle mass, not 45kg bodyweight. Losing fat while building...
--   Goal is 45kg muscle mass, not 45kg bodyweight (the earlier "Gain weight
--     (45kg)" was a mistake). Losing fat while building muscle.
--   Gain weight 45kg
--
-- The last of those is the mistake the other two were written to correct, and
-- it was still sitting on her Plans tab as something she is working towards.
--
-- WHY THE ARCHIVE GOES HERE AND NOT IN THE APP. A guard belongs at the write.
-- There are already two writers of a goal - the chat route and the onboarding
-- screen - and the chat one arrives through a trigger on a different table, so
-- an app-side rule would have to be remembered in both and would be missed by
-- the third. Setting archived_at here also means the Almanac card is written by
-- the trigger that already does that, rather than by a second copy of it.
--
-- WHAT THIS DELIBERATELY DOES: a goal stated in chat retires EVERY goal that
-- was current, not only the previous chat one. "What you're working towards" is
-- a statement of where somebody is pointed, and the Plans card shows it as one
-- thing. The cost is that somebody adding a SECOND, genuinely different goal -
-- "I also want to run a 10k" - retires the first rather than sitting beside it.
-- That is Ruth's stated intent ("instead of replacing") and the cost is small
-- because nothing is lost: the retired goal keeps its row, its dates, and
-- appears in the Almanac under Goal history. If that case turns out to matter,
-- the fix is for the classifier to say which it meant, and this trigger to read
-- that - not to go back to never retiring anything.

create or replace function public.mirror_context_goal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(new.category, '') ilike '%goal%'
     and length(btrim(coalesce(new.content, ''))) > 0 then

    -- RETIRE FIRST, INSERT SECOND, and the order is the point. Archiving after
    -- the insert would archive the goal that was just stated, because it is by
    -- then one of the current ones - a trigger that quietly retires every goal
    -- the moment it is set.
    --
    -- Exempting it by context_id instead would work and is more fragile: it
    -- relies on the new row being found by a column that is nullable. Doing it
    -- before means the set being retired is exactly the set that was current
    -- when she spoke, which is also the thing that is true.
    update public.user_goals
       set archived_at = now()
     where user_id = new.user_id
       and archived_at is null;

    insert into public.user_goals
      (user_id, goal_key, label, source, context_id, set_on, sort_order)
    values
      (new.user_id, null, btrim(new.content), 'chat', new.id, new.created_at::date, 100)
    on conflict (context_id) where context_id is not null do nothing;
  end if;
  return new;
end;
$function$;

comment on function public.mirror_context_goal() is
  'A goal stated in chat becomes the current goal and retires whatever was current before it. The retired rows keep their dates and reach the Almanac under Goal history through goal_archived_to_almanac, which fires on archived_at. Retiring runs BEFORE the insert so the new goal is not caught by its own trigger.';
