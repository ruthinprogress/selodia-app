-- A WEEK ROW REMEMBERS WHERE IT CAME FROM (5 October 2026).
--
-- The setup screen may remove only what it created. Until now that was expressed
-- as a fixed list of ten labels in the screen's own code: anything matching one of
-- them was its own, and a French class added in chat was not.
--
-- Ruth's new screen lets her type her own activities, so the fixed list stops
-- working as a boundary: "Lake swimming" typed here is the screen's, and
-- "Lake swimming" mentioned in chat is not, and the label cannot tell them apart.
--
-- THIS IS THE SAME SHAPE AS THE GOALS WIPE OF 2 OCTOBER, which is why it gets a
-- column rather than a cleverer guess. That screen widened its scope from "rows I
-- wrote" to "every active row" and archived a goal it had never shown her. The
-- rule here stays "only what this screen created", and now the row says so.
--
-- NULL MEANS BEFORE TODAY. Existing rows keep null and are backfilled below only
-- where the label matches one the screen used to offer, which is exactly what the
-- old code treated as its own.
alter table public.user_week
  add column if not exists source text;

comment on column public.user_week.source is
  'Where the row came from: ''setup'' for the "What do you already do?" screen, '
  'null for anything older or added elsewhere. The setup screen may remove only '
  'its own rows, which is what stops a walk through setup deleting something she '
  'added in chat. See mobile/src/lib/week-write-plan.ts.';

update public.user_week
set source = 'setup'
where source is null
  and activity in (
    'Walking', 'Running', 'Gym or weights', 'Yoga', 'Pilates', 'Swimming',
    'Cycling', 'Dance or ballet', 'Bar work or calisthenics', 'Classes of some kind'
  );
