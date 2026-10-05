-- AFTER FINISH (Ruth, 5 October 2026).
--
-- Setup ends on a moment rather than on a summary screen: the last question's
-- button says Finish, the screen fades to terracotta, the seed mark appears and
-- the app opens on her Body Manual. Her first draft screen is gone.
--
-- TWO STAMPS, AND BOTH ARE ABOUT HAPPENING ONCE.
--
--   welcome_seen_at      she has been through the welcome sequence
--   chat_first_opened_at she has opened Chat at least once
--
-- STORED ON THE ACCOUNT, NOT ON THE HANDSET. The same decision as the tab
-- tooltips and the Almanac intro, and it was reversed to get here once already:
-- a device flag brings a one-time moment back after a reinstall and again on a
-- second device. Being shown something happens to a person, not to a phone.
--
-- NULLABLE WITH NO DEFAULT, so "has not happened yet" is a real state rather
-- than a date somebody has to interpret.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profile'
      and column_name = 'welcome_seen_at'
  ) then
    alter table public.user_profile add column welcome_seen_at timestamptz;
    comment on column public.user_profile.welcome_seen_at is
      'When the post-Finish welcome sequence was last shown. Null means never.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profile'
      and column_name = 'chat_first_opened_at'
  ) then
    alter table public.user_profile add column chat_first_opened_at timestamptz;
    comment on column public.user_profile.chat_first_opened_at is
      'When Chat was first opened. While null, the Body Manual shows the seed that leads there.';
  end if;
end $$;
