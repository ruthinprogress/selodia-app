-- Protein-quality classification (Part Eight, build item 12): the parse LLM tags
-- each protein's source at log time (the principled log-time classification per
-- Part Two principle 13, not a downstream keyword list). On food_logs it's the
-- log's dominant source (so simple/un-itemised logs still count toward the
-- day-level nudge); on food_items it's per-item (for item 13's flags). Null when
-- the food carries negligible protein.
alter table food_logs add column protein_source text
  check (protein_source in ('animal', 'plant', 'collagen'));
alter table food_items add column protein_source text
  check (protein_source in ('animal', 'plant', 'collagen'));
