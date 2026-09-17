-- A Samsung daily summary shows two calorie figures, and they answer different
-- questions. "Total burnt calories" (1,374 on 16 September) is everything the
-- body used that day, resting included. "Activity calories" (158) is what the
-- day's movement added on top. Only the first was being stored, and it was then
-- shown as though it were what she had burned by moving.
--
-- kcal_burned keeps its meaning - the whole day - so nothing that already reads
-- it changes. active_kcal is the movement figure, stored beside it.
--
-- INFORMATION ONLY. Neither figure feeds TDEE. The 4 September decision stands:
-- the calorie target stays anchored to the onboarding activity multiplier.

alter table daily_activity_summaries
  add column if not exists active_kcal numeric;

comment on column daily_activity_summaries.kcal_burned is
  'Whole-day burn including resting, as the tracker reports it. Information only; never feeds TDEE.';
comment on column daily_activity_summaries.active_kcal is
  'Calories from movement only (Samsung "Activity calories"). Information only; never feeds TDEE.';
