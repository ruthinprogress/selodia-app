-- The itemised food breakdown, attached to the chat turn that acknowledged it.
--
-- The alternative was having the model write a markdown table into its reply and
-- parsing it back on the client. That is a lossy round trip: the model would be
-- re-stating numbers as prose, which can drift from what was actually stored,
-- and a table that disagrees with the database is exactly the class of defect
-- save-honesty.ts exists to prevent. So the turn carries a REFERENCE and the
-- client renders from food_items directly - the table is a view of the data,
-- never a retelling of it.
--
-- Nullable: almost every turn has no food attached. ON DELETE SET NULL rather
-- than CASCADE - deleting a food entry (build item 10d) must not delete the
-- conversation that happened around it; the turn simply loses its table.
alter table chat_messages
  add column food_log_id uuid references food_logs(id) on delete set null;

create index chat_messages_food_log_id_idx
  on chat_messages (food_log_id)
  where food_log_id is not null;
