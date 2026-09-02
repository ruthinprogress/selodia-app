-- Onboarding targets (mobile/SELODIA_SPEC.md, Part Seven steps 10-11): height
-- for the Mifflin-St Jeor BMR starting estimate, and a categorical activity
-- level. Both nullable - collected during onboarding, null until then. The
-- activity multiplier lives in code (calculateTDEE, app/lib/body-metrics.ts), so
-- the column only stores the level, whose allowed values match the ActivityLevel
-- keys. Additive and non-destructive.

alter table user_profile add column height_cm numeric;
alter table user_profile add column activity_level text
  check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active'));
