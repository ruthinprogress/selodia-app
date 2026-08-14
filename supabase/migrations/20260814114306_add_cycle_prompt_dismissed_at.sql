-- Non-nagging cooldown for the cycle-tracking discovery prompt (Part Thirteen):
-- when the invitation is dismissed we stamp this, and suppress the prompt for a
-- cooldown window before one gentle re-offer. Mirrors steps_permission_declined.
alter table user_profile add column cycle_prompt_dismissed_at timestamptz;
