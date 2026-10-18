-- A WEEK CARD CAN CARRY A REMINDER.
--
-- Ruth, 18 October 2026, after two people at the climbing gym said what they
-- liked about another app was that "it told them what to do and when", and one
-- of them had switched the notifications on.
--
-- Selodia had progressions, plans and reminders, and no wire between them.
-- There were exactly two kinds of reminder: the app's own daily prompt to log,
-- and anything somebody asked for in their own words. Neither was derived from
-- a plan, so nothing ever said "today is the wall walks".
--
-- WHY THE TIME IS A NEW COLUMN RATHER THAN time_of_day. time_of_day is prose on
-- purpose, and the reasoning is written into week-view.tsx: "7pm", "evening",
-- "after the school run" and "before work" are all answers she might give, and
-- only one is a clock time. Parsing it would throw the other three away. It
-- says plainly that nothing sorts or alarms on it. So a reminder cannot read
-- it, and gets its own field that is always a real time.
--
-- WEEKLY AND RECURRING, like the card. `days` already holds day NAMES rather
-- than dates, so "Monday and Thursday" is still true next week; the reminder
-- fires on those same days at remind_at.
alter table public.user_week
  -- The clock time the reminder fires, local to the person. Null means no
  -- reminder, which is the default and the common case.
  add column if not exists remind_at time,
  -- Minutes BEFORE remind_at to fire, for "half an hour before my class".
  -- Null or 0 means fire at the time itself. Offered only where the card
  -- already has a real time to be before.
  add column if not exists remind_offset_minutes integer,
  -- SWITCHED OFF FROM THE NOTIFICATION ITSELF, without opening the app, which
  -- is the most important part of the design. Ruth: the moment somebody is
  -- irritated by a nudge is exactly the moment to offer them the exit, and
  -- making them go rummaging through settings is how a helpful app becomes one
  -- they delete.
  --
  -- It is a TIMESTAMP rather than a boolean so the app can tell "never wanted
  -- one" from "had one and stopped it", and never offers the same person the
  -- same reminder twice.
  add column if not exists reminder_cancelled_at timestamptz;

comment on column public.user_week.remind_at is
  'Local clock time the weekly reminder fires, on the card''s own days. Null means none. Never derived from time_of_day, which is prose.';
comment on column public.user_week.reminder_cancelled_at is
  'Set when the reminder was switched off FROM the notification. Storage, not just the local schedule - restoreReminders re-applies from stored state on every launch, so cancelling the alarm alone brings it back.';

-- Only rows that actually have one, which is the query the scheduler runs.
create index if not exists user_week_with_reminders
  on public.user_week (user_id)
  where remind_at is not null and reminder_cancelled_at is null;
