-- Step 5 RLS/backfill follow-up, piece 2: backfill orphaned single-tenant
-- data to the first real account, then lock user_id to NOT NULL

update body_measurements set user_id = '37ce3854-b805-4dd6-95f1-0a670e67d27d' where user_id is null;
update activity_logs set user_id = '37ce3854-b805-4dd6-95f1-0a670e67d27d' where user_id is null;
update food_logs set user_id = '37ce3854-b805-4dd6-95f1-0a670e67d27d' where user_id is null;

alter table body_measurements alter column user_id set not null;
alter table activity_logs alter column user_id set not null;
alter table food_logs alter column user_id set not null;
alter table user_context alter column user_id set not null;
alter table chat_messages alter column user_id set not null;
alter table cycle_events alter column user_id set not null;
