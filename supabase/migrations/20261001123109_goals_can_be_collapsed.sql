-- WORKING TOWARDS, FOLDED AWAY.
--
-- Ruth, 1 October 2026, UI refinement item 1: the goal card takes too much
-- vertical space, and she wants it collapsible with the state remembered.
--
-- "This is both a space-saving feature and a PRIVACY feature, allowing users to
-- comfortably open Selodía in public." That is the half that decides where the
-- flag lives. A goal on this app is "lose body fat", "get stronger", something
-- about a body - and the person sitting next to her on a train can read a phone
-- screen. One tap has to hide it, and it has to STAY hidden.
--
-- ON THE ACCOUNT, NOT THE DEVICE, and that is a lesson already written down in
-- mobile/src/lib/almanac-intro.ts: that flag started in AsyncStorage and had to
-- be moved here, because the card came back after a reinstall and appeared again
-- on a second phone. "I do not want my goals on show" is a fact about a person,
-- not about a handset. A privacy preference that forgets itself is worse than no
-- preference, because by then she will have stopped checking.
--
-- DEFAULT FALSE: open. Somebody who has never expressed a preference should see
-- what she is working towards, which is the whole point of the card sitting at
-- the top of Plans. Hiding it by default would answer a question nobody asked.
alter table public.user_profile
  add column if not exists goals_collapsed boolean not null default false;

comment on column public.user_profile.goals_collapsed is
  'True when she has folded the "What you are working towards" card shut. A '
  'privacy preference as much as a layout one - see the migration note. On the '
  'account rather than the device, deliberately.';
