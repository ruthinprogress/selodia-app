-- A NAME SHE ACTUALLY USED SHOULD FIND THE DRAWING.
--
-- resolve_illustration_refs matches an exact name or an exact word set, and
-- nothing weaker, which is right: a subset match turns "cossack squat" into
-- "supported cossack squat" and shows somebody the wrong movement, which is a
-- form fault rather than a cosmetic one.
--
-- But that strictness leaves real names unresolved. Three of them have been
-- sitting in her plans since the pipeline was built:
--
--   "wall-supported middle split slide"
--   "wall-supported middle splits"
--   "rotating cossack squat (hands-free, full depth)"
--
-- All three are drawn. None of them resolve, because the plan calls the
-- movement something slightly different from the file.
--
-- WHY NOT REUSE movement_aliases. It exists and does exactly this job - for
-- CLIPS. Its join_key column holds clip names: "back barbell squat" resolves
-- to "barbell full squat", which is a row in movement_assets and has nothing
-- to do with the illustration library. Pointing the illustration resolver at
-- it would let an alias resolve to a drawing that does not exist. Two
-- namespaces that happen to describe the same movements are still two
-- namespaces.
--
-- THE FOREIGN KEY IS THE POINT OF THE TABLE. An alias that names a drawing we
-- do not have is the bug this is meant to prevent, so the database refuses to
-- store one rather than leaving it to be noticed later. A guard at the write,
-- as everywhere else in this project.

create table if not exists public.illustration_aliases (
  -- The normalised WORD SET, not the raw text, so an alias matches however the
  -- words are ordered or spaced. Always written through movement_match_key -
  -- hand-typing this column is how it silently stops matching.
  alias_key   text primary key,
  join_key    text not null references public.movement_illustrations (join_key) on delete cascade,
  -- Why somebody decided this name means this drawing. Worth a sentence: the
  -- next person to read a surprising alias should not have to guess.
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.illustration_aliases enable row level security;

drop policy if exists read_illustration_aliases on public.illustration_aliases;
create policy read_illustration_aliases
  on public.illustration_aliases
  for select
  to authenticated
  using (true);

-- The resolver gains the third arm, in the same shape and the same order as
-- public.resolve_movement_refs, so the two can never disagree about what a name
-- means. Exact name, then word set, then an explicit human decision - and the
-- explicit decision ranks LAST, so it can never override a real match.
create or replace function public.resolve_illustration_refs(names text[])
returns table(input_name text, join_key text)
language sql
stable
set search_path to 'public'
as $$
  select n.name, m.join_key
  from unnest(names) as n(name)
  left join lateral (
    -- 1. the normalised name IS a join_key
    select i.join_key, 1 as rank
    from public.movement_illustrations i
    where i.join_key = btrim(regexp_replace(lower(n.name), '\s+', ' ', 'g'))
    union all
    -- 2. the WORD SET is a join_key's word set
    select i.join_key, 2
    from public.movement_illustrations i
    where public.movement_match_key(i.join_key) = public.movement_match_key(n.name)
    union all
    -- 3. somebody has said, explicitly, that this name means this drawing
    select al.join_key, 3
    from public.illustration_aliases al
    where al.alias_key = public.movement_match_key(n.name)
    order by rank
    limit 1
  ) m on true
$$;

grant execute on function public.resolve_illustration_refs(text[]) to authenticated;

-- The three that prompted this. alias_key is computed rather than typed.
insert into public.illustration_aliases (alias_key, join_key, note)
values
  (
    public.movement_match_key('wall-supported middle split slide'),
    'middle splits at the wall',
    'Her plans call stage 5 of the side splits a slide. Same movement, same wall.'
  ),
  (
    public.movement_match_key('wall-supported middle splits'),
    'middle splits at the wall',
    'The same stage with the wall named first rather than last.'
  ),
  (
    public.movement_match_key('rotating cossack squat (hands-free, full depth)'),
    'deep cossack squat to the floor',
    'Hands-free and full depth is the third cossack stage. The rotation is Ruth''s own coaching note on it: pivot on the heel and let the toe turn up, which is what lets the hip travel to the floor.'
  )
on conflict (alias_key) do nothing;
