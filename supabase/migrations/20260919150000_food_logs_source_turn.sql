-- WHICH SPOKEN TURN WROTE THIS ROW (2026-09-19). The voice guard used to clear
-- every food row created since an earlier version of a sentence, from any
-- source - a typed or photographed meal in the same half minute would have
-- gone with it. Rows written by a voice turn now carry that turn, and only
-- rows proven to come from an earlier version of the same sentence are ever
-- removed. Null for every other kind of log, which the guard never touches.
alter table public.food_logs
  add column if not exists source_turn_id uuid references public.chat_messages (id) on delete set null;
create index if not exists food_logs_source_turn_idx on public.food_logs (source_turn_id)
  where source_turn_id is not null;
