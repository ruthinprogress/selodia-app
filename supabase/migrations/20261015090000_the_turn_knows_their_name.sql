-- THE TURN KNOWS THEIR NAME (15 October 2026).
--
-- Going back over the comparison run: the email draft written to her vein
-- clinic ended with four blanks, one of them "[your date of birth]", and the
-- reply explained that it did not have the details.
--
-- Her date of birth was in user_profile the whole time, and so was her first
-- name. turn_context already selected date_of_birth - for working out an age
-- and a metabolic rate - and nothing ever passed either fact to a prompt, so
-- the draft writer was being scrupulously honest about something the app knew
-- and had never told it. first_name was not selected at all, which is this
-- migration; the rest of the fix is app/lib/who-they-are.ts.
--
-- WHY IT IS WORTH A MIGRATION FOR ONE COLUMN. Ruth asked for drafts that land
-- ready to send: "Write the draft email directly into an email client draft
-- with header and email address populated." A letter still needing four fields
-- filled before it can go is one she has to sit down with, and sitting down
-- with it is where things stop happening - the same drop-off as the phone menu
-- and the portal.
--
-- Her surname, address and telephone number are deliberately NOT added. They
-- are nowhere structured, they live on the letters she has photographed, and
-- care_constants exists for exactly that. A gap stays a gap.
--
-- ---------------------------------------------------------------------------
-- PATCHED IN PLACE, AND THE FIRST ATTEMPT WAS NEARLY A BAD BUG.
--
-- The obvious move is to copy the newest turn_context migration, add the
-- column and re-run the whole body. That was written and nearly applied. The
-- newest file that defines the function WHOLE is from 1 October, and four
-- things have been added to the live function since: careRows, skillRows,
-- feelRows and feelLookback. Replaying the October body would have silently
-- DELETED all four - the care records, the skills and the feel goals would have
-- stopped reaching every turn, with nothing failing and nothing to notice.
--
-- So this does what the care-record migration of 6 October did: read the LIVE
-- definition, change the one thing, and execute that. The repository is not the
-- source of truth for this function; the database is.
do $outer$
declare
  def text;
  old_select text := $anchor$        select height_cm, unsafe_goal_flagged_at, date_of_birth$anchor$;
  new_select text := $anchor$        select first_name, height_cm, unsafe_goal_flagged_at, date_of_birth$anchor$;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;

  -- Idempotent: running it twice is a no-op rather than a second column.
  if position('first_name' in def) > 0 then
    raise notice 'first_name already selected, nothing to do';
    return;
  end if;

  if position(old_select in def) = 0 then
    raise exception 'the profileRow select has changed shape; patch it by hand';
  end if;

  def := replace(def, old_select, new_select);
  execute def;
end
$outer$;
