-- A ME CARD AND A CARE RECORD CAN BE PICKED UP IN CHAT (14 October 2026).
--
-- Ruth, naming what the product is: "this is what replaces Claude, actually
-- being able to pick up anywhere in chat and it knows what you're talking about
-- and gives you exactly what you need, instead of a project in Claude."
--
-- A chat turn can already be anchored to the thing being discussed, and four
-- kinds were allowed: food, activity, measurement, plan. Her Me cards and her
-- care records - the referral, the insurer claim, the practice, the numbers she
-- is asked for at a desk - were the one part of her life that could not be
-- carried in. "Talk this through" on a referral sent a sentence naming it and
-- this constraint dropped the tag, so the thread was never anchored and a
-- follow-up of "what was that number" had nothing to hold on to.
--
-- Both are rows in almanac_entries, like 'plan' already is, so nothing else
-- about the shape changes.

alter table public.chat_messages drop constraint if exists chat_messages_discuss_entry_type_check;
alter table public.chat_messages add constraint chat_messages_discuss_entry_type_check
  check (discuss_entry_type = any (array['food', 'activity', 'measurement', 'plan', 'me', 'care']));
