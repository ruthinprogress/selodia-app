-- Re-link every saved plan's exercises to the movement library.
--
-- demoRef is resolved once, when a plan is saved. A plan saved before its clip
-- existed keeps a null for good, so a library that grows every month would never
-- reach the plans that were waiting for it. The monthly release job calls this
-- after adding clips; it is also safe to run by hand at any time.
--
-- Only exercises whose reference CHANGES are rewritten, and only rows with at
-- least one change are touched, so re-running it is a no-op. Returns the number
-- of plans updated.
--
-- Service role only. It writes across every user's rows, which is exactly why
-- the app must never be able to call it.

create or replace function public.reresolve_plan_demo_refs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  with plans as (
    select a.id,
           a.content,
           (
             select jsonb_agg(
                      case
                        when r.join_key is distinct from (e.value ->> 'demoRef')
                          then e.value || jsonb_build_object('demoRef', r.join_key)
                        else e.value
                      end
                      order by e.ordinality
                    )
             from jsonb_array_elements(a.content -> 'exercises') with ordinality e
             left join lateral (
               select join_key
               from public.resolve_movement_refs(array[e.value ->> 'name'])
               limit 1
             ) r on true
           ) as exercises
    from almanac_entries a
    where jsonb_typeof(a.content -> 'exercises') = 'array'
      and jsonb_array_length(a.content -> 'exercises') > 0
  ),
  changed as (
    update almanac_entries t
    set content = jsonb_set(p.content, '{exercises}', p.exercises)
    from plans p
    where t.id = p.id
      and p.exercises is distinct from p.content -> 'exercises'
    returning t.id
  )
  select count(*) into updated from changed;
  return updated;
end;
$$;

revoke all on function public.reresolve_plan_demo_refs() from public, anon, authenticated;
grant execute on function public.reresolve_plan_demo_refs() to service_role;
