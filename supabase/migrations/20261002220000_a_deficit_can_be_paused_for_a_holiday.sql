-- A DEFICIT CAN BE PAUSED, AND IT IS STILL HER GOAL.
--
-- Ruth, 2 October 2026: "I think if you go on holiday you may want to pause the
-- deficit."
--
-- TWO PAUSES, AND THEY ARE NOT THE SAME PAUSE. `training_state` says whether
-- there is a training stimulus, which is what earns the protein step-up and the
-- muscle-gain surplus. This says whether she wants to be eating under what she
-- uses right now. A fortnight in Spain is a reason to stop the deficit and no
-- reason at all to drop her protein; an injury is the reverse. Collapsing them
-- into one "paused" would make each one do the other's work badly.
--
-- PAUSING IS NOT ABANDONING. Her fat-loss goal stays exactly where it is, the
-- goal screen still reads the same, and nothing is archived. The calorie target
-- goes to maintenance until she says otherwise. The distinction matters because
-- the alternative - telling her to change her goal for a holiday and change it
-- back after - is how an app teaches somebody that a week off means starting
-- again.
--
-- NO AUTOMATIC EXPIRY, AND NO END DATE ASKED FOR. An end date would be the app
-- deciding when her holiday finished, and a date she has to remember to set is
-- a date she will forget and then be surprised by. The set-at stamp is shown on
-- the row instead, so a pause from three weeks ago reads as three weeks old.
-- Same reasoning as training_state, and the same shape on purpose.

alter table public.user_profile
  add column if not exists deficit_state text;

alter table public.user_profile
  drop constraint if exists user_profile_deficit_state_check;

alter table public.user_profile
  add constraint user_profile_deficit_state_check
  check (deficit_state is null or deficit_state in ('on', 'paused'));

alter table public.user_profile
  add column if not exists deficit_state_set_at timestamptz;

comment on column public.user_profile.deficit_state is
  'Whether she wants the fat-loss deficit running right now. Null and ''on'' both '
  'mean running - null is simply "never said", and the deficit is what choosing '
  'to lose fat already asked for. Only ''paused'' holds the target at maintenance, '
  'and it never changes her goal. See mobile/src/lib/calorie-target.ts.';
