-- WHERE A SIGN-UP CAME FROM (Ruth, 7 October 2026).
--
-- Each article links to selodia.app with its own tag - selodia.app/?src=post-01
-- - and the tag is kept with the sign-up so the daily log can say which writing
-- actually brought people in.
--
-- NULL MEANS HOMEPAGE AND IS NOT BACKFILLED. Every row that exists today came in
-- before any tag existed, so they are homepage by fact rather than by default.
-- Writing 'homepage' into them would be inventing a provenance for rows nobody
-- tagged; the reader treats null as homepage, which is true for the old rows and
-- true for anyone arriving at the plain address.
alter table public.waitlist add column if not exists src text;

-- A TAG, NOT A FREE FIELD. It arrives from a query string a stranger controls,
-- so the column refuses anything that is not a short slug. The app sanitises
-- too; this is the half that holds when the app is wrong.
alter table public.waitlist drop constraint if exists waitlist_src_is_a_tag;
alter table public.waitlist add constraint waitlist_src_is_a_tag
  check (src is null or (length(src) between 1 and 40 and src ~ '^[a-z0-9][a-z0-9-]*$'));

comment on column public.waitlist.src is
  'The ?src= tag the sign-up arrived with. Null means the plain homepage.';
