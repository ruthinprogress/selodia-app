-- A DIAGNOSTIC KIND THE TABLE WILL ACCEPT (15 October 2026).
--
-- recordDecisionFields was added this afternoon to count which of the deciding
-- tool's thirty-odd fields are ever used, so the dead ones can be cut from the
-- call that costs the most output tokens. It wrote rows of kind 'fields'.
--
-- turn_diagnostics allows two kinds and only two:
--
--   CHECK (kind = ANY (ARRAY['timing', 'error']))
--
-- So every one of those inserts was rejected. Nothing broke - the recorder
-- swallows its errors by design, because a turn must never fail because its
-- diagnostics did - and the instrument simply recorded nothing at all.
--
-- CAUGHT BY ASKING THE LIVE APP, NOT BY A CHECK. Every check passed: the code
-- calls the recorder, before the overrides, with names and no values. What no
-- check could see is that the row never arrived. scripts/probe-todays-work.mjs
-- sent one real turn to the deployed server and looked for the row, which is
-- the only question that mattered.
--
-- THE CONSTRAINT STAYS A CONSTRAINT. The easy fix is to drop it and let any
-- string in; the reason it exists is that this table is read by hand and a
-- typo'd kind is a row nobody ever finds again. So it gains one value.

alter table public.turn_diagnostics
  drop constraint if exists turn_diagnostics_kind_check;

alter table public.turn_diagnostics
  add constraint turn_diagnostics_kind_check
  check (kind = any (array['timing'::text, 'error'::text, 'fields'::text]));

comment on column public.turn_diagnostics.kind is
  'timing: the phase marks of a turn. error: something the route caught. fields: which of the classifier tool''s fields the model set, by name only, so the unused ones can be found and cut.';
