-- REMEMBER WHO ASKED, SO THEY CAN BE THANKED.
--
-- Ruth, 18 October 2026: "When the users illustration lands, they should get a
-- notification, nice little touch to thank them for contributing to Selodia...
-- Infact it could actually be a thank you note that also tells them it's there."
--
-- movement_gaps deliberately has NO user column: one row per movement, counted
-- across every account, so times_asked is real demand rather than one person's
-- habits. That is still right, and it is also why it cannot answer "who do I
-- thank". This table answers that without touching it.
--
-- ONE ROW PER PERSON PER MOVEMENT, not per ask. Somebody who puts the same
-- movement in four plans is thanked once, not four times, and thanked_at means
-- a corrected re-upload cannot thank them again.

create table if not exists public.movement_gap_requesters (
  match_key   text not null references public.movement_gaps (match_key) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  first_asked timestamptz not null default now(),
  thanked_at  timestamptz,
  primary key (match_key, user_id)
);

create index if not exists movement_gap_requesters_to_thank
  on public.movement_gap_requesters (match_key)
  where thanked_at is null;

alter table public.movement_gap_requesters enable row level security;

-- Somebody may see their own requests and nobody else's. The aggregate count
-- stays impersonal; this is the only place it becomes personal, and it is
-- readable only by the person it is about.
drop policy if exists read_own_movement_requests on public.movement_gap_requesters;
create policy read_own_movement_requests
  on public.movement_gap_requesters
  for select
  to authenticated
  using (user_id = auth.uid());

-- record_movement_gap gains a third argument. The earlier two-argument version
-- is replaced rather than overloaded: two functions with the same name and
-- different arity is how a caller ends up silently hitting the old one.
create or replace function public.record_movement_gap(
  movement_name text,
  plan_title text default null,
  asked_by uuid default null
)
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

  if asked_by is not null then
    insert into public.movement_gap_requesters (match_key, user_id)
    values (key, asked_by)
    on conflict (match_key, user_id) do nothing;
  end if;
end;
$$;

grant execute on function public.record_movement_gap(text, text, uuid) to authenticated, service_role;

-- Who has not yet been thanked for a movement that now exists.
create or replace function public.requesters_to_thank(movement_name text)
returns table(user_id uuid, name text, times_asked integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.user_id, g.name, g.times_asked
  from public.movement_gap_requesters r
  join public.movement_gaps g on g.match_key = r.match_key
  where r.match_key = public.movement_match_key(movement_name)
    and r.thanked_at is null
$$;

grant execute on function public.requesters_to_thank(text) to service_role;

create or replace function public.mark_requesters_thanked(movement_name text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  update public.movement_gap_requesters
     set thanked_at = now()
   where match_key = public.movement_match_key(movement_name)
     and thanked_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.mark_requesters_thanked(text) to service_role;
