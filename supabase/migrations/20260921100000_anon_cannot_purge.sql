-- ANONYMOUS CALLERS DO NOT NEED TO PURGE ANYTHING (21 September 2026).
--
-- Both purge functions were reachable from the public API without signing in.
-- The harm is small - they delete only rows that have already expired - but
-- neither is ever called by an anonymous caller: the report and Me-export
-- routes both run them with the signed-in person's own client, immediately
-- before writing a new page. So this is a capability nobody uses, exposed to
-- everybody, which is the definition of one worth removing.
--
-- get_report, get_me_export and report_exists KEEP their anon execute, and that
-- is deliberate rather than an oversight: the whole design is a browser with no
-- session opening an unguessable link, which is how a report reaches a print
-- dialogue at all. They are narrow by construction - one row, by id, unexpired,
-- nothing listable.
revoke execute on function public.purge_expired_report_exports() from anon;
revoke execute on function public.purge_expired_me_exports() from anon;
