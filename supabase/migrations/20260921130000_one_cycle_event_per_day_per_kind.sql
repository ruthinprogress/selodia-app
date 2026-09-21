-- SAYING IT TWICE DOES NOT MAKE IT TWO PERIODS (Ruth, 21 September 2026).
--
-- She asked for the chat to be able to fill the Cycle page in by speaking:
-- "the chat should be able to fill it in directly from just speaking". And
-- separately, about hindsight: "the cycle 'started' and 'ended' needs to be
-- sleecteable in hindsight. I rarelt rememebr to add it to my calendar on the
-- day it started or ended."
--
-- Put those two together and a duplicate is not a hypothetical. Somebody taps
-- "started" on the Cycle page, then mentions it in chat an hour later, then
-- corrects the day the next morning. That is three messages about ONE event.
--
-- A GUARD BELONGS AT THE WRITE. Cycle length is arithmetic on the gaps between
-- these rows, so two period starts on the same day is not a cosmetic duplicate:
-- it is a zero-length cycle in an average that then steers a prediction for
-- months. The chat writer upserts onto this index, so a thing said twice lands
-- once.

create unique index if not exists cycle_events_one_per_day
  on public.cycle_events (user_id, event_date, event_type);
