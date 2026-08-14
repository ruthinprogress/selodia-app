-- The onboarding_step CHECK constraint (onboarding_step_valid, added in
-- 20260811120000) omitted 'health_context', but the app advances the step to
-- 'health_context' on that screen. The upsert therefore violated the constraint
-- and silently failed, so the step could never be recorded there. Add the value,
-- positioned (for readers) between goals and technical_targets per the flow order.
alter table user_profile drop constraint onboarding_step_valid;
alter table user_profile add constraint onboarding_step_valid check (
  onboarding_step in ('not_started', 'intro', 'equipment', 'goals', 'health_context', 'technical_targets', 'nutrition_targets', 'activity_tdee', 'complete')
);
