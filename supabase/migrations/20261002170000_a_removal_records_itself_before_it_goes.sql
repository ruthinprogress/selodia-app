-- A REMOVAL RECORDS ITSELF BEFORE IT GOES.
--
-- Ruth, 2 October 2026: "It is unlikely allergies stop, but best to make it safe."
-- And on history: "like everything else, history is accessed via Almanac."
--
-- WHY NOT SOFT DELETE, WHICH WAS MY FIRST PROPOSAL. Adding archived_at to these
-- tables means every reader must filter, and the food gate is one of those
-- readers. A removed allergy still sitting in the table is one forgotten filter
-- away from still blocking food, or from being read as live. That is precisely the
-- shape of bug this week has been made of: a row that still exists and something
-- still reading it.
--
-- A DELETED ROW CANNOT BE MISREAD. So the row goes, and the FACT of its going is
-- written to the Almanac first. History is preserved where she already looks for
-- history, and no reader anywhere needs to change.
--
-- AT THE WRITE, NOT IN A SCREEN. Several places can remove these rows and more
-- will. A card written by whichever screen happens to do it is a list maintained
-- by hand away from the thing it describes, which is how three writers went
-- missing from the honesty guard. The database writes the card, so no removal path
-- can forget to.
--
-- NOT ON user_week YET, deliberately. The activities screen still bulk-deletes
-- rows when a chip is deselected, and that would fill her Almanac with noise. The
-- trigger goes on when "redo my setup" is removed and that bulk path with it; the
-- function already handles the table.
--
-- WHAT THE CARD SAYS, AND WHAT IT DOES NOT. What was removed, from which part of
-- the Body Manual, and when. No judgement about why and no guess at whether it
-- stopped applying or was entered by mistake, because the app does not know.

create or replace function removal_to_almanac()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  what text;
  which text;
begin
  if tg_table_name = 'allergies' then
    what := old.name;
    which := case
      when old.kind in ('food') then 'On your plate'
      when old.kind in ('contact', 'environmental') then 'Skin and air'
      when old.kind = 'medicine' then 'Medicines you react to'
      else 'Anything else to steer around'
    end;
  elsif tg_table_name = 'user_rules' then
    what := old.phrase;
    which := 'Movements to leave out';
  elsif tg_table_name = 'user_week' then
    what := old.activity;
    which := 'What you already do';
  elsif tg_table_name = 'user_skills' then
    what := old.name;
    which := 'What you want to be able to do';
  else
    return old;
  end if;

  if what is null or btrim(what) = '' then return old; end if;

  insert into almanac_entries (user_id, kind, title, category, content)
  values (
    old.user_id,
    'body_manual_change',
    what,
    'Body Manual',
    jsonb_strip_nulls(jsonb_build_object(
      'change', 'removed',
      'what', what,
      'section', which,
      'removed_on', to_char(now(), 'YYYY-MM-DD'),
      'summary', 'Removed from ' || which || '. Kept here so you can see what changed.'
    ))
  );
  return old;
end
$$;

drop trigger if exists removal_to_almanac on allergies;
create trigger removal_to_almanac before delete on allergies
  for each row execute function removal_to_almanac();

drop trigger if exists removal_to_almanac on user_rules;
create trigger removal_to_almanac before delete on user_rules
  for each row execute function removal_to_almanac();

drop trigger if exists removal_to_almanac on user_skills;
create trigger removal_to_almanac before delete on user_skills
  for each row execute function removal_to_almanac();

comment on function removal_to_almanac is
  'A removal from the Body Manual writes an Almanac card before the row goes. At the write rather than in a screen, because several places remove these rows and a hand-kept list of them goes stale. Deliberately NOT soft delete: a deleted row cannot be misread by the food gate.';
