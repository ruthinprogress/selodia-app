-- CLOSE THE REQUEST WHEN THE THING IS MADE.
--
-- Ruth, 18 October 2026: "as soon as that illustration, animation or video
-- exists, it should automatically populate in pre-made plans... So users can
-- see their requests actually land, they're listened to."
--
-- The picture appearing in somebody's existing plan is automatic: the movement
-- card resolves by name every time it opens, so a drawing made this week turns
-- up in a plan written last month without anybody touching the plan. That part
-- was already true for drawings and was NOT true for clips - the card's
-- condition froze the clip answer at save time - and almanac-detail.tsx now
-- asks both on every open.
--
-- This is the bookkeeping half. The row that recorded the ask stops being
-- outstanding, so the to-make list shrinks as things get made instead of
-- growing for ever.
--
-- IT ONLY CLOSES SOMETHING STILL WANTED. A row already marked drawn, clipped or
-- declined is left exactly as it is: re-uploading a corrected picture must not
-- quietly reopen and re-close a decision somebody made.
--
-- Returns how many times it had been asked for, so whoever made it can see the
-- work landed on something real.
create or replace function public.close_movement_gap(
  movement_name text,
  new_status text default 'drawn'
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  key text := public.movement_match_key(movement_name);
  asked integer;
begin
  if key is null or key = '' then
    return null;
  end if;

  -- The same word set the resolver uses, so "Wrist prep (circles, palm and
  -- fingertip rocks)" is closed by drawing "wrist prep".
  update public.movement_gaps
     set status = new_status
   where match_key = key
     and status = 'wanted'
  returning times_asked into asked;

  return asked;
end;
$$;

grant execute on function public.close_movement_gap(text, text) to service_role;
