-- The stored daily summary (Part Nine).
--
-- Daily temporary context is the SECOND of the spec's two memory mechanisms,
-- and the distinction matters: durable facts (a goal, an allergy, a diagnosis)
-- go to user_context via the classify tool and stand forever. This is the other
-- kind - a stressful work trip, a birthday dinner, a rough night - which
-- matters for interpreting ONE day and is not a permanent fact about anyone.
--
-- Stored rather than discarded, for two specific downstream uses:
--   1. the next-morning weave: when a body measurement arrives, a mediating
--      factor from yesterday is brought into that morning's interpretation
--      BEFORE the person has a chance to spiral about a number;
--   2. the weekly roundup, which builds on these rather than reprocessing a
--      week of raw chat.
--
-- mediating_factor is separate from context on purpose. Context is the day's
-- narrative; the mediating factor is the one thing that would explain tomorrow's
-- reading, and the next-morning path needs to find it without re-reading prose.
--
-- One row per user per day: a day gets closed out once, and re-running must
-- correct that day rather than accumulate duplicates.
create table daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null,
  context text,
  interpretation text,
  mediating_factor text,
  created_at timestamptz not null default now(),
  unique (user_id, summary_date)
);
create index daily_summaries_user_date_idx on daily_summaries (user_id, summary_date desc);
alter table daily_summaries enable row level security;
create policy "manage_own" on daily_summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
