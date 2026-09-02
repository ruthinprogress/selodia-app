-- Consistent-ratio clarification tracking (build item 11, slice 2a): when Selodia
-- logs a composite dish with an assumed material variable and gently asks about
-- it, the pending question (the variable name) is pinned here so the next-turn
-- answer can resolve and re-parse the right log. Cleared on resolve or when a new
-- food log supersedes it.
alter table food_logs add column clarification_pending text;
