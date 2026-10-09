-- WHAT cycle_days ACTUALLY HOLDS, said in the database itself.
--
-- Ruth, 9 October 2026, settling how symptoms work: "A symptom is just a
-- symptom. So if a symptom is logged in chat it will not necessarily be
-- interpreted as a cycle symptom. But it is attached to a day, so all days need
-- to be reviewed for patterns when a symptom is reported. otherwise the user is
-- magically having to figure out which symptoms to log as cycle symptoms and
-- which are noncycle symptoms."
--
-- THE NAME SAYS THESE ROWS ARE ABOUT CYCLES. They are not. They are about DAYS.
-- The original migration already got this right in prose - "cycle_days is what
-- a day FELT like" - but a name is read far more often than a comment three
-- files away, and the obvious reading of cycle_days.symptoms is "symptoms
-- belonging to a cycle".
--
-- WHY THAT MATTERS, CONCRETELY. Somebody says their shoulder has ached for a
-- week, in February, with no period logged for months. Under the rule above
-- that is a symptom on a day and the lookback must still work on it. Anyone -
-- me included, in a session that has forgotten this conversation - reading the
-- table name could reasonably decide a shoulder is not cycle data, and either
-- not write it here or filter it out. The app would then be quietly deciding
-- which of her symptoms count, which is the exact thing she ruled out.
--
-- NOT RENAMED, DELIBERATELY. cycle_days is live, carries her data, has RLS
-- policies and is read by the Cycle screen. A migration, re-pointed policies
-- and every reference touched is real risk for a naming preference. A comment
-- on the table does the same job for nothing, and shows up in any schema
-- inspection - which is where the wrong assumption would otherwise be made.

comment on table public.cycle_days is
  'A DAY RECORD, not a cycle record. One row per person per calendar day: what '
  'that day felt like - flow, symptoms, ovulation signs, mucus, notes, '
  'temperature. A symptom here belongs to the DAY and to nothing else. Cycle '
  'position is DERIVED by the app from the date and the person''s period '
  'history in cycle_events; it is never stored here and never declared by the '
  'person. There is no such thing as a "cycle symptom" in this schema - there '
  'are symptoms, on days, and a day happens to sit somewhere in a cycle. Every '
  'symptom reaches this table whatever route it came in by: typed, spoken, or '
  'tapped on the Cycle screen. Named cycle_days on 21 September 2026 before '
  'that rule existed; see migration 20261009200000.';

comment on column public.cycle_days.symptoms is
  'Free text array. Chips from the picker AND anything she typed herself - the '
  'picker is a shortcut, never the vocabulary. Not restricted to '
  'cycle-related symptoms; see the table comment.';

comment on column public.cycle_days.day is
  'The calendar day this record is about, in her local time. The key to '
  'everything else: cycle position, patterns across cycles, and joins to what '
  'else she logged that day.';
