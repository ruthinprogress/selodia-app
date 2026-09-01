-- The selodia.app launch waitlist.
--
-- THE ONLY PUBLICLY WRITABLE TABLE IN THIS SCHEMA, and the only one with no
-- user_id. Every other table is scoped by `auth.uid() = user_id` and belongs to
-- a signed-in person; this one is filled in by strangers on a marketing page
-- before an account exists, so it cannot be scoped that way and does not try.
--
-- RLS: INSERT ONLY, and the absence of a SELECT policy is the design rather than
-- an omission. Anyone may add themselves; nobody may read the list back through
-- the API, including the person who just wrote a row. The list is readable only
-- via the Supabase dashboard, which uses the service-role key and bypasses RLS.
-- Without that asymmetry a public insert policy would also make every email
-- address on the list harvestable with the anon key, which is printed in the page
-- source of the very form that collects them.
--
-- No UPDATE and no DELETE policy either: a waitlist entry should not be editable
-- by the public, and removing someone is a request to handle deliberately rather
-- than an endpoint to expose.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  -- Optional, and genuinely optional: the form asks for a name because a launch
  -- email that opens with one is warmer, not because anything requires it.
  name text,
  email text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitive, because someone re-submitting as Ruth@… having first used
-- ruth@… is the same person and should not become a second row. The write path
-- treats the resulting unique violation as success (see app/page.tsx): telling
-- somebody already on the list that something went wrong would be both wrong and
-- alarming.
create unique index waitlist_email_key on waitlist (lower(email));

alter table waitlist enable row level security;

-- `to public` covers both the anon and authenticated roles: the page is public
-- and has no session, but a signed-in person visiting it should not be refused
-- either. `with check (true)` because there is no ownership to verify - the row
-- belongs to nobody until it is read from the dashboard.
create policy "anyone_can_join" on waitlist for insert to public with check (true);
