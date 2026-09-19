-- The Me tab, as a page somebody can print (Me brief, "Export"; built 2026-09-19).
--
-- WHY A TABLE AND A FUNCTION RATHER THAN THE SERVICE ROLE. The export opens in
-- the phone's browser, which carries no session, so something has to serve the
-- page to a request with no identity. The service role could, but it is kept
-- to exactly one job in this codebase - signing licensed demo clips - and
-- widening that for convenience is how a narrow key stops being narrow.
--
-- So the page is rendered WITH the person's own session and stored here for a
-- few minutes; the browser fetches it by an unguessable id through one
-- SECURITY DEFINER function that can do nothing else. The id is the capability,
-- it expires, and nobody can list, read or alter the table directly.

create table if not exists public.me_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  html text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

alter table public.me_exports enable row level security;

create policy "me_exports_insert_own" on public.me_exports
  for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.get_me_export(export_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select html from public.me_exports
  where id = export_id and expires_at > now()
  limit 1;
$$;

revoke all on function public.get_me_export(uuid) from public;
grant execute on function public.get_me_export(uuid) to anon, authenticated;
