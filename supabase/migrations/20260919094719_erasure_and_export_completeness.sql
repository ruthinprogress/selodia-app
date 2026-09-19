-- ERASURE AND EXPORT, BROUGHT UP TO DATE (2026-09-19).
--
-- Every table holding a person's data cascades when their account is deleted,
-- so erasure was always complete in the end. But account deletion removes each
-- table from the phone first and then COUNTS what is left before removing the
-- account, reporting anything remaining as "could not be removed". A table the
-- owner is not allowed to delete from would therefore always report as a
-- failure, telling somebody their data had survived when it was about to go.
--
-- consent_records stays append-only in the sense that matters - nothing can be
-- EDITED, so what was agreed and when cannot be rewritten - while its owner can
-- erase it along with everything else, which UK GDPR requires.
create policy "consent_records_delete_own" on public.consent_records
  for delete using (auth.uid() = user_id);

-- Error reports from somebody's phone are their personal data too, and go when
-- they do.
create policy "client_error_log_delete_own" on public.client_error_log
  for delete using (auth.uid() = user_id);

-- me_exports holds a fifteen-minute copy of a person's Me tab for the browser to
-- fetch. Expired copies were never removed, so every export left its page in
-- the database indefinitely. This clears expired copies - anyone's, since an
-- expired copy serves no purpose to anybody - and is called at every new export.
create or replace function public.purge_expired_me_exports()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.me_exports where expires_at < now();
$$;

revoke all on function public.purge_expired_me_exports() from public;
grant execute on function public.purge_expired_me_exports() to authenticated;
