-- A CHAT THAT LEADS, SWITCHED ON ONE ACCOUNT AT A TIME (13 October 2026).
--
-- Ruth signed off the plan that evening: one model leads the turn, on her
-- account only, beside the current chat, until it has beaten her own Claude
-- Project on her own examples. This is the switch. Off for everybody by
-- default, so adding the column changes nothing for anyone; app/lib/lead-turn.ts
-- reads it, and treats an unreadable value as off.
--
-- Switching it off again is the way back: the account returns to today's chat
-- on its next message, with nothing else to undo.

alter table public.user_profile
  add column if not exists lead_chat boolean not null default false;

comment on column public.user_profile.lead_chat is
  'When true, typed chat turns are led by one model end to end (app/lib/lead-turn.ts). Off by default; switched on per account.';
