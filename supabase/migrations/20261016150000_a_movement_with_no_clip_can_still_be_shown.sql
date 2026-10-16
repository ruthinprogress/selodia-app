-- A MOVEMENT WITH NO CLIP CAN STILL BE SHOWN.
--
-- The vendor library holds 950 clips and covers movement patterns, not every named
-- exercise. Across Ruth's own saved plans, 13 of 45 movements resolved to a
-- demonstration - twenty-nine per cent. Her verdict on opening a plan built in chat:
-- "one one exercise had a video and I have no idea how to do the rest."
--
-- movement-howto.ts closed part of that gap with words. This closes the rest with
-- pictures: a library of illustrations Selodia owns, drawn in the house style, one
-- file per movement holding the start position above the finish position.
--
-- WHY A SEPARATE TABLE AND NOT A COLUMN ON movement_assets. The clips are Exercise
-- Animatic's, licensed, private, and served through a signed URL because their terms
-- forbid end users reaching the files. The illustrations are ours, and the two will
-- diverge: most illustrations are for movements that have NO clip, and a few deliberately
-- duplicate one because a progression has to look like a set. Hanging them off the
-- vendor's table would tangle two different things with two different licences.
--
-- WHY THE MATCHING MIRRORS resolve_movement_refs EXACTLY.
--
-- An exact name, or an exact word set, and nothing weaker. Word-set matching is not
-- fuzzy matching: "seated straddle stretch" and "straddle stretch seated" are the same
-- words in a different order, so nothing is added, dropped or approximated.
--
-- A SUBSET RULE WAS MEASURED AND REJECTED when the clip matcher was built: on real plan
-- names it matched "kettlebell romanian deadlifts" to the SINGLE-LEG variant, and a
-- third of the matches it added were a different movement under a different load. The
-- same rule governs here and for the same reason, now with a picture attached: a missing
-- illustration is a small disappointment, a confidently wrong one is a form fault.
--
-- NO ALIAS TABLE YET, deliberately. movement_aliases maps a name onto a CLIP's join_key,
-- and most illustration join_keys will never be clip join_keys, so reusing it would let
-- an alias resolve to an illustration nobody chose. Aliases get curated here when a real
-- miss turns up, one at a time, the way the clip aliases were - never by loosening this.

create table if not exists public.movement_illustrations (
  -- The canonical movement name, lowercased and single-spaced, the same shape as
  -- movement_assets.join_key so one convention covers both libraries.
  join_key      text primary key,

  -- What a card shows above the picture. The join_key is machine-facing.
  title         text not null,

  -- Path inside the movement-illustrations bucket.
  storage_path  text not null,

  -- A progression is drawn as a whole set, even the stages that already have a clip,
  -- because a set half in 3D render and half in line drawing looks broken. These two
  -- columns are what lets the app show the set in order; both are null for a movement
  -- that belongs to no progression.
  progression   text,
  stage         smallint,

  -- An animation is an UPGRADE on the still, made from its two frames, not a
  -- replacement: the still is still the poster frame and the fallback. Null until one
  -- is made, and most movements will never need one - two pictures say everything a
  -- clip would for a butterfly stretch.
  animation_path text,

  created_at    timestamptz not null default now(),

  constraint movement_illustrations_stage_needs_progression
    check ((progression is null) = (stage is null))
);

create index if not exists movement_illustrations_progression_idx
  on public.movement_illustrations (progression, stage)
  where progression is not null;

alter table public.movement_illustrations enable row level security;

-- Readable by any signed-in account, exactly like movement_assets. Writes are
-- service-role only: the library is curated by the pipeline, never by the app.
drop policy if exists read_movement_illustrations on public.movement_illustrations;
create policy read_movement_illustrations
  on public.movement_illustrations
  for select
  to authenticated
  using (true);

-- The resolver. Deliberately the same shape as public.resolve_movement_refs so the two
-- can never disagree about what a name means, minus the alias arm.
--
-- match_key is computed here rather than stored. The table holds about a hundred rows,
-- so the cost is nothing, and it removes a column that could silently fall out of step
-- with the function that fills it.
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
    order by rank
    limit 1
  ) m on true
$$;

grant execute on function public.resolve_illustration_refs(text[]) to authenticated;
