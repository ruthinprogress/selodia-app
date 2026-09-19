-- Supabase security advisor, 2026-09-19, before beta.
--
-- purge_expired_me_exports was revoked from PUBLIC, but Supabase grants anon
-- its own execute on new functions, so anybody could call it without signing
-- in. It only ever removes expired copies, so nothing was exposed, but there
-- is no reason for an anonymous caller to run it at all.
revoke execute on function public.purge_expired_me_exports() from anon;

-- A fixed search_path, so the function cannot be pointed at a look-alike
-- object planted in another schema.
alter function public.movement_match_key(text) set search_path = public;

-- get_me_export stays callable by anon ON PURPOSE: the browser that prints the
-- Me tab has no session, and the copy is found only by an unguessable id and
-- expires after fifteen minutes.
