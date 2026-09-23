-- EVERY ROW WAS ASKING WHO YOU ARE (23 September 2026).
--
-- Found by running Supabase's performance advisors, which had never been run -
-- only the security ones had. Forty-one row level security policies call
-- `auth.uid()` directly, and Postgres re-evaluates that FOR EVERY ROW it
-- checks. Reading a year of food logs asks who you are once per meal.
--
-- Wrapping it in a sub-select makes it an InitPlan: evaluated once per query,
-- then reused. Identical semantics - `auth.uid()` returns the same value all
-- the way through a statement - and it is Supabase's own documented fix.
--
-- IT MATTERS HERE MORE THAN MOST. Ruth's own instruction from 21 September:
-- "we are designing for Selodia as a multiuser app with thousands of users and
-- this is a test account - it needs to be properly scoped, not build for the
-- test account's current test state". At one user with a few hundred rows this
-- is invisible. At a thousand users with years of history it is the difference
-- between a report that builds and one that times out.
--
-- Rewritten with ALTER POLICY rather than drop-and-create, so there is never a
-- moment where a table sits without its policy.

do $$
declare
  p record;
  new_qual text;
  new_check text;
  changed int := 0;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      -- Skip anything already wrapped, so this is safe to run twice.
      and coalesce(qual, '') not like '%SELECT auth.uid()%'
      and coalesce(with_check, '') not like '%SELECT auth.uid()%'
  loop
    new_qual := replace(coalesce(p.qual, ''), 'auth.uid()', '(select auth.uid())');
    new_check := replace(coalesce(p.with_check, ''), 'auth.uid()', '(select auth.uid())');

    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)',
                     p.policyname, p.tablename, new_qual, new_check);
    elsif p.qual is not null then
      execute format('alter policy %I on public.%I using (%s)',
                     p.policyname, p.tablename, new_qual);
    elsif p.with_check is not null then
      execute format('alter policy %I on public.%I with check (%s)',
                     p.policyname, p.tablename, new_check);
    end if;

    changed := changed + 1;
  end loop;

  raise notice 'rewrote % policies', changed;
end $$;

-- FOUR POLICIES DOING WHAT ONE ALREADY DOES. food_cache carried `manage_own`
-- (FOR ALL) plus a select, insert, update and delete policy with byte-identical
-- conditions, so every query on it evaluated the same test twice. Verified
-- identical before dropping: each one is `auth.uid() = user_id`, which is
-- exactly what manage_own says.
--
-- Dropping the duplicates and keeping manage_own loses no protection: a
-- permissive policy set is an OR, so removing a clause that repeats another
-- clause cannot widen access.
drop policy if exists food_cache_select_own on public.food_cache;
drop policy if exists food_cache_insert_own on public.food_cache;
drop policy if exists food_cache_update_own on public.food_cache;
drop policy if exists food_cache_delete_own on public.food_cache;

-- FOREIGN KEYS WITH NOTHING TO LOOK THEM UP BY. Each of these is a join or a
-- cascade delete doing a sequential scan.
create index if not exists me_exports_user_id_idx on public.me_exports (user_id);
create index if not exists report_exports_user_id_idx on public.report_exports (user_id);
create index if not exists workout_completion_log_activity_log_id_idx on public.workout_completion_log (activity_log_id);
create index if not exists workout_completion_log_plan_id_idx on public.workout_completion_log (plan_id);
create index if not exists workout_weight_log_plan_id_idx on public.workout_weight_log (plan_id);
