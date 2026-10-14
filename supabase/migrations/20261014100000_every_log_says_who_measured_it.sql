-- EVERY LOG SAYS WHO MEASURED IT (Ruth, 14 October 2026).
--
-- Her reason, before there are users to make it expensive: "unless we make
-- Selodia compatible with that, people that have tracking watches aren't going
-- to manually start typing in data everyday... better to think about this at
-- this stage because once we have users it might be harder to adjust the
-- infrastructure."
--
-- AND THE REASON IT MATTERS MORE THAN CONVENIENCE. Her Mi Fit watch told her she
-- had slept eight uninterrupted hours on nights she was up six to eight times
-- feeding the baby. A companion that takes that as fact does not merely store a
-- wrong number, it reasons from it: about her energy, her recovery, her week. So
-- a reading has to carry where it came from, for ever, or the app cannot tell
-- what she told it from what a machine guessed, and cannot let her word win.
--
-- WHY A NEW COLUMN RATHER THAN THE `source` ONES THAT EXIST. Four tables already
-- have `source`, and it answers a different question: HOW it was entered - 'chat',
-- 'manual text', 'tapped', 'said', 'log', 'workout plan'. Useful, and kept. None
-- of it distinguishes her from a device, because it was never meant to.
--
-- VALUES: 'person' for anything she typed, said or tapped, and the platform it
-- came from otherwise ('health_connect', 'apple_health', and so on). Deliberately
-- not constrained to a list: a platform added in a year must not need a migration
-- before a single row can be written.
--
-- EVERY EXISTING ROW IS 'person', WHICH IS TRUE: nothing has ever been read from
-- a device except the step summaries, and those are corrected below from the
-- provenance they already carry in prose.

alter table public.food_logs              add column if not exists recorded_by text not null default 'person';
alter table public.hydration_logs         add column if not exists recorded_by text not null default 'person';
alter table public.activity_logs          add column if not exists recorded_by text not null default 'person';
alter table public.sleep_logs             add column if not exists recorded_by text not null default 'person';
alter table public.body_measurements      add column if not exists recorded_by text not null default 'person';
alter table public.cycle_events           add column if not exists recorded_by text not null default 'person';
-- cycle_days is a VIEW over daily_observations, which is covered above.
alter table public.daily_observations     add column if not exists recorded_by text not null default 'person';
alter table public.daily_ratings          add column if not exists recorded_by text not null default 'person';
alter table public.daily_activity_summaries add column if not exists recorded_by text not null default 'person';

-- The step summaries are the one thing already read from a device. Their origin
-- is in `source` as prose ('phone health platform', 'Samsung daily summary'),
-- which names a device but not which platform, so they become the honest
-- 'device' rather than a guess at Health Connect or HealthKit.
update public.daily_activity_summaries
   set recorded_by = 'device'
 where recorded_by = 'person'
   and source is not null
   and source <> '';

comment on column public.food_logs.recorded_by is
  'Who measured this: ''person'' when they typed, said or tapped it, otherwise the platform it was read from (health_connect, apple_health...). A device reading is evidence, not truth; the person''s word overrides it.';
comment on column public.sleep_logs.recorded_by is
  'As food_logs.recorded_by. Sleep especially: a watch reporting uninterrupted hours is a claim to show them, never a fact to reason from.';
comment on column public.daily_activity_summaries.recorded_by is
  'As food_logs.recorded_by. ''device'' on rows imported before the platform was recorded individually.';
