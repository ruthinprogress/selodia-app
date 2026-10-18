-- LET A CHECK READ WHAT IS ACTUALLY DEPLOYED.
--
-- Ruth's standing rule is that a migration needs a file too, because
-- apply_migration writes only to the remote and a change that exists in one
-- place drifts. This is the other half of that rule: the file needs a database
-- that agrees with it.
--
-- Three of today's faults were a written thing disagreeing with a built thing,
-- and the checks that caught them all worked the same way - they compared two
-- sources rather than reading one. A migration file is a record of what was
-- INTENDED. It proves nothing about a function someone edited in the dashboard,
-- or a migration written and never applied.
--
-- So one function, returning the deployed source of another, for checks to read.
--
-- SERVICE ROLE ONLY. Function bodies are not secret here - they are all in the
-- repository - but they name tables and columns, and there is no reason for a
-- signed-in person's key to be able to enumerate them. Checks run with the
-- service key on a developer machine; nothing in the app calls this.

create or replace function public.pg_function_source(fn_name text)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
  select pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = fn_name
    and p.prokind = 'f'
  limit 1;
$$;

comment on function public.pg_function_source(text) is
  'The deployed source of a public function, for check scripts that must compare what is RUNNING against what was written down. Service role only; nothing in the app calls it.';

-- Default grants put execute on public, which is the thing to undo here.
revoke all on function public.pg_function_source(text) from public;
revoke all on function public.pg_function_source(text) from anon;
revoke all on function public.pg_function_source(text) from authenticated;
grant execute on function public.pg_function_source(text) to service_role;
