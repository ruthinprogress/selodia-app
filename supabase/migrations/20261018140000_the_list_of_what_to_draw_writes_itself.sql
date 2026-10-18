-- THE LIST OF WHAT TO DRAW NEXT SHOULD WRITE ITSELF.
--
-- Ruth, 18 October 2026: "If there is genuinely something thats missing to
-- achieve the user goal, they can do the text-only route - but only then. When
-- an excersise is genuinely required but wasnt there, it needs to be recorded
-- as 'to be built/illustrated' and this creates the list of what's needed over
-- time."
--
-- WHY THIS IS BETTER THAN THE SCRIPT WE HAVE. scope-illustration-gaps.mjs
-- answers "what is missing" by sweeping saved plans on demand, which means
-- somebody has to remember to run it, and it weighs a movement asked for once
-- the same as one asked for every week. This records a gap AT THE MOMENT IT
-- MATTERS - when a plan is saved and the movement turns out to have nothing
-- behind it - and counts how often that happens.
--
-- So the list is demand-ordered by construction. The thing drawn next is the
-- thing people keep being given as words.
--
-- NO MODEL COOPERATION IS REQUIRED, which is the point. The chat does not have
-- to remember to flag anything, and cannot forget to. saveAlmanacEntry already
-- resolves every exercise name to find its clip; anything that resolves to
-- neither a clip nor a drawing is recorded there, in the same pass. A guard at
-- the write, as everywhere else in this project.

create table if not exists public.movement_gaps (
  -- The normalised word set, so "Wrist prep (circles, palm and fingertip
  -- rocks)" and "wrist prep" are one row rather than two. Always written
  -- through movement_match_key.
  match_key      text primary key,

  -- The clearest name seen for it, for somebody reading the list. Updated to
  -- the shortest one seen, because the model's longer phrasings are usually
  -- the same movement with coaching bolted on.
  name           text not null,

  -- How many times a plan has been saved containing this movement with nothing
  -- behind it. THE ORDERING COLUMN: this is the whole point of the table.
  times_asked    integer not null default 1,

  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),

  -- What it was wanted for, most recently. One title is enough to tell whether
  -- "pike hold" means the yoga shape or the handstand drill.
  last_plan      text,

  -- wanted  - nothing exists, worth making
  -- drawn   - an illustration now covers it (set by the upload script)
  -- clipped - an alias now points it at a real clip
  -- declined- deliberately not making this one
  status         text not null default 'wanted'
                 check (status in ('wanted', 'drawn', 'clipped', 'declined'))
);

create index if not exists movement_gaps_wanted
  on public.movement_gaps (times_asked desc)
  where status = 'wanted';

alter table public.movement_gaps enable row level security;

-- READ ONLY FOR EVERYBODY, WRITTEN ONLY BY THE SERVER. The row is a fact about
-- the library rather than about a person, and the service role does the
-- writing from saveAlmanacEntry.
drop policy if exists read_movement_gaps on public.movement_gaps;
create policy read_movement_gaps
  on public.movement_gaps
  for select
  to authenticated
  using (true);

-- Record one gap, or count another ask against one already known.
--
-- THE SHORTEST NAME WINS. The same movement arrives as "Wrist prep", "Wrist
-- prep (circles, palm and fingertip rocks)" and "wrist prep circles". Keeping
-- the shortest gives the list the name somebody would actually put on a card,
-- which is also the name the drawing should be filed under.
--
-- A GAP THAT HAS BEEN FILLED STAYS FILLED. If the status has moved on from
-- 'wanted' this still counts the ask and moves last_seen, but does not drag
-- the row back onto the to-do list - that would undo a decision somebody made.
create or replace function public.record_movement_gap(movement_name text, plan_title text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  key text := public.movement_match_key(movement_name);
  tidy text := btrim(movement_name);
begin
  if key is null or key = '' then
    return;
  end if;

  insert into public.movement_gaps (match_key, name, last_plan)
  values (key, tidy, plan_title)
  on conflict (match_key) do update
    set times_asked = public.movement_gaps.times_asked + 1,
        last_seen   = now(),
        last_plan   = coalesce(excluded.last_plan, public.movement_gaps.last_plan),
        name        = case
                        when length(excluded.name) < length(public.movement_gaps.name)
                        then excluded.name
                        else public.movement_gaps.name
                      end;
end;
$$;

grant execute on function public.record_movement_gap(text, text) to authenticated, service_role;
