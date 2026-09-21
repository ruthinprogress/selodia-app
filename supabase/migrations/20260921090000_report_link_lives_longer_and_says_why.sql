-- FIFTEEN MINUTES WAS TOO SHORT FOR HOW SHE USES IT (21 September 2026).
-- She built a report at a desk, came back to the tab, and got "This report has
-- expired. Build it again." The system had worked perfectly: the page was
-- stored, the link was valid, and the clock had simply run out while she was
-- reading. A window shorter than the task it serves reads as a broken feature.
--
-- Two hours covers a desk session, a print, and a change of mind, and still
-- means a health document does not sit at a URL indefinitely.
alter table public.report_exports
  alter column expires_at set default (now() + interval '2 hours');

-- TELLING "EXPIRED" APART FROM "NEVER EXISTED". get_report returns nothing for
-- both, so the page blamed the clock for every failure - including a link that
-- was never real. The ids are version-4 UUIDs and nothing lists them, so
-- confirming that one exists reveals nothing to anybody who did not already
-- have it.
create or replace function public.report_exists(report_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.report_exports where id = report_id);
$$;

revoke all on function public.report_exists(uuid) from public;
grant execute on function public.report_exists(uuid) to anon, authenticated;
