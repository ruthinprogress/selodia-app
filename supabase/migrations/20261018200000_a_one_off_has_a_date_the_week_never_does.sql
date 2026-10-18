-- A ONE-OFF HAS A DATE. THE WEEK NEVER DOES.
--
-- Ruth, 18 October 2026, drawing the line herself:
--
--   "Week is a template of your week, it's not a real week, so anything on
--    there is a regular activity... It's not a calendar. It's not for one-off
--    appointments. If it was a one-off appointment, they would ask in chat to
--    add something to their calendar (that's build already right?)"
--
-- It was not built. She then said: "we need to build calendar also then."
--
-- WHY A SECOND TABLE AND NOT A COLUMN ON user_week. user_week stores day NAMES
-- rather than dates on purpose, so "Monday and Thursday" is still true next
-- week, and its own comment says it is "a list, not a calendar". A date cannot
-- live there without making every row ask "is this one of the recurring ones?"
-- - and that question would then have to be asked at every read, which is the
-- shape of bug that hid in the week all week. Two tables, two meanings.
--
-- WHAT THIS IS ACTUALLY FOR, and it is not a general diary. health-support.ts
-- has carried the gap written down since the Health work:
--
--   Put it in your diary        no appointments table, no calendar integration
--
-- Appointments are the demand. A physio slot, a scan, a GP call back, the one
-- class she is going to once. Date, time, where, what to bring - those four are
-- named in that file and they are the columns here.
--
-- IT STILL DOES NOT WRITE TO THE CALENDAR ON HER PHONE, and three places in the
-- prompt say so today. That sentence stays true and has to stay said: this is
-- Selodia's own diary, not a bridge to Google or Apple. Promising otherwise is
-- the one over-claim this table makes easy.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- What it is, in her words. No kind, no category, no type: addToWeek settled
  -- that argument already ("Nothing here checks what the thing is, and nothing
  -- should"), and a French class earns its place the same way a scan does.
  title text not null check (length(btrim(title)) > 0),

  -- THE DATE IS REQUIRED AND THE TIME IS NOT, which is the whole reason this
  -- is two columns and not one timestamptz.
  --
  -- "My scan is on the 24th" is a complete thing to be told and carries no
  -- time at all. A timestamptz would force one to be invented, and an invented
  -- 9am on a hospital letter is worse than no time, because it looks like
  -- information. Null time means the day is known and the hour is not.
  event_date date not null,
  event_time time,

  -- Where, and what to bring. Both named in health-support.ts as what somebody
  -- needs in their hand at the door. Free text: an address, a ward, "the blue
  -- entrance by the car park", "bring the letter and a urine sample".
  place text,
  what_to_bring text,
  notes text,

  -- THE REMINDER, in the same shape as a week card's so the arithmetic is
  -- shared rather than written twice. fireTime() in week-reminder-time.ts
  -- already subtracts the offset and clamps at the start of the day, and is
  -- already tested for both.
  --
  -- The difference is that this one fires ONCE. A week card's reminder is
  -- weekly because its days are names; this one has a date, so it is a single
  -- scheduled notification and then it is over.
  remind_at time,
  remind_offset_minutes integer,
  -- Switched off from the notification itself, same as the week's. A timestamp
  -- rather than a boolean so "never wanted one" and "had one and stopped it"
  -- stay different answers.
  reminder_cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NO COMPLETION COLUMN, and that is deliberate here as it is on user_week
-- ("nothing here is ever marked done or missed"). An appointment that has
-- happened is in the past, and the date already says so. A tick box would
-- invite a count of kept and missed appointments, which is a judgement about
-- somebody's illness dressed up as a feature.

comment on table public.calendar_events is
  'One-off dated things, chiefly appointments: date, time, place, what to bring. The counterpart to user_week, which holds day NAMES and recurs forever. A date lives here and nowhere else. No completion column, deliberately. This is Selodia''s own diary and does NOT write to the calendar app on the phone.';
comment on column public.calendar_events.event_time is
  'Null means the day is known and the hour is not, which is the normal state of a hospital letter. Never invent one.';
comment on column public.calendar_events.remind_at is
  'Local clock time the single reminder fires. Null means none. Offset is subtracted from it by fireTime(), shared with the week reminders.';

alter table public.calendar_events enable row level security;

create policy read_own_calendar_events
  on public.calendar_events
  for select
  to authenticated
  using (user_id = auth.uid());

create policy write_own_calendar_events
  on public.calendar_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy change_own_calendar_events
  on public.calendar_events
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE IS A REAL DELETE HERE, unlike a week card. An appointment that was
-- cancelled or written down wrongly should go, and there is no Anytime for it
-- to fall into: a date is the only place it could sit.
create policy remove_own_calendar_events
  on public.calendar_events
  for delete
  to authenticated
  using (user_id = auth.uid());

-- The two reads the app actually makes: what is coming up, and what needs a
-- reminder scheduling.
create index if not exists calendar_events_upcoming
  on public.calendar_events (user_id, event_date, event_time);
create index if not exists calendar_events_with_reminders
  on public.calendar_events (user_id, event_date)
  where remind_at is not null and reminder_cancelled_at is null;
