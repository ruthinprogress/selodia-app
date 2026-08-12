-- Two additions to the classification check constraint:
-- 1. 'neutral' - ask-unflump's non-distress classification for ordinary
--    conversation, added when the safety-classification system was
--    extended to that route. Missed updating this constraint at the
--    time, which silently failed every 'neutral'-classified assistant
--    turn's insert (11 user turns vs 7 assistant turns in the same
--    window, confirmed via direct query before this fix).
-- 2. 'grief_related_distress' - new tier, mapped to Cruse Bereavement
--    Support in the resource lookup table.
alter table chat_messages drop constraint chat_messages_classification_check;
alter table chat_messages add constraint chat_messages_classification_check
  check (classification in (
    'clear_goal', 'ambiguous_goal', 'neutral',
    'ordinary_discouragement', 'ambiguous_distress',
    'eating_related_distress', 'grief_related_distress', 'acute_crisis'
  ));
