-- HOUSEKEEPING SHOULD NOT BE A BUTTON ANYONE CAN PRESS (21 September 2026).
--
-- me_exports and report_exports each hold a short-lived copy of somebody's own
-- health data for the browser to fetch. Two one-line functions clear the copies
-- whose time is up, and both were called by the EXPORTING USER's own session on
-- the way in - so both had to be executable by `authenticated`, and the security
-- advisor was right to flag it: they run with elevated rights, which means any
-- signed-in person could clear anybody's expired copies on demand.
--
-- The risk was small, because an expired copy is already dead. The real fault
-- was the shape: a maintenance job reachable from the public API, and cleanup
-- that only ever happened when somebody else happened to make an export.
--
-- THAT SECOND HALF IS THE ONE THAT ACTUALLY MATTERED. This is health data with
-- an expiry on it. It should leave because its time is up, not because another
-- person came along and triggered the sweep. On a quiet week an expired report
-- could sit there for days.
--
-- So it runs every fifteen minutes on its own, and nobody can call it.

create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-me-exports',
  '*/15 * * * *',
  $$select public.purge_expired_me_exports()$$
);

select cron.schedule(
  'purge-expired-report-exports',
  '*/15 * * * *',
  $$select public.purge_expired_report_exports()$$
);

-- The door closes now that something else is doing the work. anon lost this on
-- 21 September in anon_cannot_purge; this is the other half.
revoke execute on function public.purge_expired_me_exports() from authenticated;
revoke execute on function public.purge_expired_report_exports() from authenticated;
