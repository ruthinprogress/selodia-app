-- THE CACHE HAS TO REMEMBER A MEAL, NOT AN INGREDIENT (Ruth, 2026-09-16).
--
-- The spec's Tier 1 stores four macro numbers against a food name, which is
-- enough for "a banana". Her correction: "the cache scope needs to cover real
-- food combinations, not just single ingredients. The whole point is
-- remembering things like my chia pudding recipe or my usual cereal mix with
-- their actual macros."
--
-- She is right, and it is the higher-value case: a composite somebody eats
-- weekly is exactly what the model has to re-reason every time, and exactly
-- where the answer is most stable per person. food_name is free text, so
-- "chia pudding" was always a valid key - what was missing is everything a
-- parse produces BESIDES the four totals.
--
-- WHY A CACHE HIT MUST CARRY MORE THAN MACROS. A logged meal also has its
-- itemised components (food_items), protein_source, amino_profile,
-- breakdown_type and sodium. Without them a remembered chia pudding would
-- silently lose its breakdown table while a freshly-parsed one kept it, and the
-- spec's own rule is that the person never sees which tier served them. That
-- rule cannot hold if the tiers produce visibly different entries.
--
-- jsonb rather than columns: this is the parse's own output shape, it already
-- changes as the parse learns (amino_profile arrived after protein_source, and
-- entry_text after both), and mirroring it in DDL would mean a migration every
-- time the prompt gains a field. Nothing queries inside it - it is read whole,
-- written whole, and belongs to the row it sits on.
--
-- Null is allowed and meaningful: a row written from Open Food Facts or the
-- McCance and Widdowson dataset has macros and no itemisation, because those
-- sources do not itemise. Such a row still serves a simple food perfectly well.
alter table food_cache
  add column if not exists parsed jsonb;

comment on column food_cache.parsed is
  'The full parsed entry this estimate came from - items, protein_source, amino_profile, breakdown_type, sodium. Null for database-sourced rows, which carry macros only. Read whole, never queried into.';
