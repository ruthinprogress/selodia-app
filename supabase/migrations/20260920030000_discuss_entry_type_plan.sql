-- A PLAN IS SOMETHING A CONVERSATION CAN BE ABOUT (2026-09-20).
--
-- "Update this" on a plan started carrying the plan's id into chat the same
-- day, and every one of those turns was refused by this check: the insert
-- failed, so the message was never written, the model never ran, and the app
-- showed "something went wrong" and then, on the retry, nothing at all.
--
-- The lesson is the check's, not the feature's: the allowed set lived in three
-- places - this constraint, app/lib/discuss-card.ts and the app's own type -
-- and only two of them were changed. A value the code can produce and the
-- table refuses is a broken write, not a guard.
alter table public.chat_messages drop constraint chat_messages_discuss_entry_type_check;
alter table public.chat_messages add constraint chat_messages_discuss_entry_type_check
  check (discuss_entry_type = any (array['food', 'activity', 'measurement', 'plan']));
