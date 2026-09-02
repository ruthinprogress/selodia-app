-- Tracks how many times Selodia has gently returned to the same distress
-- disclosure after the person deflected, so it can allow one return but
-- stop re-raising it after a second explicit decline (see
-- SELODIA_LANGUAGE_RULES.md's deflection-handling rule). Read from the
-- immediately preceding assistant turn, same pattern as escalation_step -
-- not a running conversation total, just "was the last turn a revisit, and
-- if so, which one."
alter table chat_messages add column distress_revisit_count integer check (distress_revisit_count >= 0);
