-- AN ACTIVITY LEVEL SHE STATED, WITH THE DATE SHE STATED IT (4 October 2026).
--
-- Ruth's item 2: the levels, one plain line each, and "Last set on [date]".
--
-- WHY THE DATE MATTERS HERE MORE THAN ANYWHERE. The level was DERIVED from the
-- cadence chips on the activities screen, with no guard, and an empty walk wrote
-- 'sedentary'. Her chips were not saving, so it was rewritten every time she
-- opened that screen - about 400 kcal a day off her maintenance, silently. A
-- derived answer has no date and nobody to ask; a stated one has both, and a
-- figure that looks wrong can be traced to the day somebody chose it.
--
-- Nothing reads this to expire the answer. An app deciding her week must have
-- changed by now would be inventing the very fact the column exists to stop it
-- inventing. It is shown to her, so she can notice it has gone stale herself.

alter table public.user_profile
  add column if not exists activity_level_set_at timestamptz;

comment on column public.user_profile.activity_level_set_at is
  'When she last chose her activity level. Null means it has never been stated - '
  'including the rows where it was derived from onboarding chips before 4 October '
  '2026, which is why those cannot be trusted. Nothing expires it.';
