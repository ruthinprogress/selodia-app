-- Build Order step 7, Phase B: tracks which of the two-step ambiguous-distress
-- escalation questions was just asked, separate from `classification` since
-- this is flow-control state (which question did the app ask), not a
-- classification of what the user said.
alter table chat_messages add column escalation_step text
  check (escalation_step in ('gentle_asked', 'direct_asked'));
