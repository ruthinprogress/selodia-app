-- Corrects Part Seven/Eight of the spec: step tracking is a native phone
-- permission (HealthKit/Health Connect), not external equipment the user
-- owns, so the field tracks permission decline rather than device ownership.
alter table user_profile
  rename column has_steps_tracker to steps_permission_declined;
