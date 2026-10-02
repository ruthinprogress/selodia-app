-- AN ARCHIVED GOAL BECOMES A CARD SHE CAN FIND.
--
-- Ruth, 2 October 2026, item 4: "GOALS keep a history: each goal dated; when
-- updated the old becomes a card in Almanac under the Goals tag, selectable and
-- searchable and usable in Report Builder."
--
-- WHY A TRIGGER RATHER THAN A LINE IN THE GOALS SCREEN. Three things can archive
-- a goal today - the setup screen, chat, and the goal screen - and more will.
-- Putting the card next to one of those writes means the other two silently do
-- not produce one, which is the shape of bug this codebase keeps paying for: a
-- list of writers maintained by hand away from the thing it describes. The row is
-- created where the archiving happens, by the database, so there is no writer to
-- forget.
--
-- IT FIRES ONLY ON THE TRANSITION. archived_at going from null to a timestamp is
-- the event. An update that touches an already-archived row does nothing, so
-- nothing can accumulate duplicate cards for one goal.
--
-- `kind` IS 'goal' AND `category` IS 'Goals', which is the tag she asked for.
-- The Almanac groups by category, searches titles, and the Report Builder reads
-- the same table - so one row satisfies "selectable, searchable, and usable in
-- Report Builder" without a second store.
--
-- THE CARD HOLDS HER OWN WORDS AND ITS DATES, and nothing else. No progress, no
-- judgement about whether she reached it, no "achieved" or "abandoned" - those
-- are both verdicts, and an old goal is a record of what she was working towards,
-- not a result.

create or replace function goal_archived_to_almanac()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    insert into almanac_entries (user_id, kind, title, category, content)
    values (
      new.user_id,
      'goal',
      new.label,
      'Goals',
      jsonb_strip_nulls(jsonb_build_object(
        'label', new.label,
        'detail', new.detail,
        'set_on', new.set_on,
        'archived_on', to_char(new.archived_at, 'YYYY-MM-DD'),
        'source', new.source,
        'summary', 'A goal you were working towards. Kept so you can look back at it.'
      ))
    );
  end if;
  return new;
end
$$;

drop trigger if exists goal_archived_to_almanac on user_goals;
create trigger goal_archived_to_almanac
  after update of archived_at on user_goals
  for each row
  execute function goal_archived_to_almanac();

comment on function goal_archived_to_almanac is
  'Item 4, 2 October 2026: an archived goal becomes an Almanac card under the Goals tag. A trigger rather than client code, because three different places archive goals and a hand-kept list of writers goes stale silently.';
