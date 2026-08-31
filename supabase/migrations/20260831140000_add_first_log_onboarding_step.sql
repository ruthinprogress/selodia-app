-- Onboarding steps 6-7 (Part Seven, build item 45): the guided food-logging
-- tour and the first-log acknowledgement.
--
-- These two were designed from the beginning and were blocked on chat-based food
-- logging, which shipped as build step 10a. They sit between equipment and goals
-- in Part Seven's sequence, and the point of them is that someone finishes
-- onboarding having ALREADY logged something real - rather than completing a
-- conversation and landing in Chat cold, with the core loop of the app still
-- entirely unexplained.
--
-- ONE STEP, NOT TWO. The design numbers them 6 and 7, but 7 is the
-- acknowledgement OF 6 - it happens on the same screen, in the turn after the
-- log lands. Persisting them separately would create a resume point in the
-- middle of a single exchange: someone who closed the app between logging and
-- being acknowledged would come back to a screen waiting to acknowledge a log it
-- had lost the thread of. The step records where the person actually is.
--
-- Follows the constraint-swap pattern exactly, per 20260811120000 (which created
-- onboarding_step_valid) and 20260814110822 (which added 'health_context' the
-- same way). A CHECK constraint cannot be extended in place, so it is dropped
-- and recreated with the full list - and the list stays ordered by flow rather
-- than alphabetically, because the next person to read it will be trying to
-- work out what happens after what.
alter table user_profile drop constraint onboarding_step_valid;
alter table user_profile add constraint onboarding_step_valid check (
  onboarding_step in ('not_started', 'intro', 'equipment', 'first_log', 'goals', 'health_context', 'technical_targets', 'nutrition_targets', 'activity_tdee', 'complete')
);

-- No backfill and no data migration. Everyone mid-flow keeps the step they are
-- on: someone already past 'equipment' simply never sees the tour, which is
-- correct - they are further into a conversation than the tour belongs in, and
-- inserting them backwards into it would be worse than them missing it.
