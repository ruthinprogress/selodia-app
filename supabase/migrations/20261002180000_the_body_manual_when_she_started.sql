-- THE BODY MANUAL WHEN SHE STARTED. One snapshot, ever.
--
-- Ruth, 2 October 2026: "I think the onboarding first time is saved as a snapshot
-- of the Body Manual starting point, and like everything else, history is accessed
-- via Almanac. Now how often, I don't know... maybe when things change a snapshot
-- is sent?"
--
-- WHY ONE AND NOT MANY, which is the part of her idea I pushed back on. A snapshot
-- is a photograph of everything at once. Taken on every change it produces dozens
-- of near-identical cards, fills the Almanac with noise, and still only shows the
-- state at sampling moments. The reason she could not answer "how often" is that
-- the question does not have a good answer.
--
-- EACH ROW ALREADY CARRIES ITS OWN HISTORY, so the change itself is the record:
-- goals archive with dates and become Almanac cards, every weight reading is its
-- own dated row, feel goals archive with started_at, Me cards keep their old
-- wording, and a removal writes a card before the row goes (removal_to_almanac).
-- "What did my Manual look like in October" is answerable exactly, from the
-- changes, rather than approximately from the nearest photograph.
--
-- BUT THE STARTING POINT IS DIFFERENT IN KIND, and she is right that it is worth
-- keeping. It is the only "before" there is. Everything after it is a change FROM
-- something; this is the something.
--
-- AT THE TRANSITION, NOT IN A SCREEN. It fires when onboarding_step becomes
-- 'complete' and only on that transition, so it cannot be written twice and no
-- screen can forget to write it. The first draft is the screen that completes
-- onboarding today; if that ever moves, this still works. Proved by stepping a real
-- account away from 'complete' and back: one card, and a repeat wrote no second one.
--
-- RUTH WILL NOT GET ONE, and it is not backfilled. Her account has been 'complete'
-- since August, so there is no moment to photograph, and inventing a "starting
-- point" out of today's rows would be a card claiming to be something it is not.

create or replace function onboarding_complete_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snap jsonb;
begin
  if new.onboarding_step is distinct from 'complete'
     or old.onboarding_step is not distinct from 'complete' then
    return new;
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'summary', 'What you told Selodía about your body when you started. Kept so you can look back at where you began.',
    'started_on', to_char(now(), 'YYYY-MM-DD'),
    'days', (
      select jsonb_agg(label order by sort_order) from feel_goals
      where user_id = new.user_id and archived_at is null
    ),
    'goals', (
      select jsonb_agg(label) from user_goals
      where user_id = new.user_id and archived_at is null
    ),
    'weight_kg', (select weight_kg from current_weight where user_id = new.user_id),
    'skills', (
      select jsonb_agg(name order by sort_order) from user_skills where user_id = new.user_id
    ),
    'week', (
      select jsonb_agg(activity order by sort_order) from user_week where user_id = new.user_id
    ),
    'on_your_plate', (
      select jsonb_agg(name) from allergies
      where user_id = new.user_id and coalesce(kind, 'other') in ('food', 'other')
    ),
    'skin_and_air', (
      select jsonb_agg(name) from allergies
      where user_id = new.user_id and kind in ('contact', 'environmental')
    ),
    'medicines', (
      select jsonb_agg(name) from allergies where user_id = new.user_id and kind = 'medicine'
    ),
    'movements_left_out', (
      select jsonb_agg(phrase) from user_rules
      where user_id = new.user_id and kind = 'never'
    ),
    'life_stage', new.life_stage,
    'hormone_use', to_jsonb(new.hormone_use)
  )) into snap;

  insert into almanac_entries (user_id, kind, title, category, content)
  values (
    new.user_id,
    'body_manual_snapshot',
    'Your Body Manual when you started',
    'Body Manual',
    snap
  );
  return new;
end
$$;

drop trigger if exists onboarding_complete_snapshot on user_profile;
create trigger onboarding_complete_snapshot
  after update of onboarding_step on user_profile
  for each row execute function onboarding_complete_snapshot();

comment on function onboarding_complete_snapshot is
  'One snapshot, ever: the Body Manual at the moment onboarding completes. Fires only on the transition to complete, so it cannot be written twice. Not on every change - each row already carries its own dates, so the change is the record and snapshots would only add noise.';

-- AND NOW THAT NOTHING BULK-DELETES HER WEEK, ITS REMOVALS ARE RECORDED TOO.
--
-- removal_to_almanac went on allergies, user_rules and user_skills earlier today
-- and deliberately not on user_week, because the activities screen deleted rows in
-- bulk whenever a chip was deselected. "Redo my setup" is gone as of this commit,
-- and with it the only path that walked that screen over existing answers, so a
-- deselection is now a deliberate act on one row.

drop trigger if exists removal_to_almanac on user_week;
create trigger removal_to_almanac before delete on user_week
  for each row execute function removal_to_almanac();
