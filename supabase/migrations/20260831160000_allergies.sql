-- Allergies and dietary restrictions as a hard structured constraint
-- (Part Twelve, build item 42).
--
-- ITS OWN TABLE, and that separation is the whole design rather than tidiness.
-- Softer preferences and dislikes live in `user_context` as category/content
-- rows written by the classify tool. The spec forbids sharing that mechanism, in
-- both directions and for two different reasons: "a dislike that leaks into the
-- allergy filter makes Unflump needlessly restrictive, and an allergy that leaks
-- into preference handling makes it dangerous." Only one of those is a safety
-- failure, so only this side gets its own guarantees.
--
-- NO DELETE PATH ANYWHERE, and that is deliberate. Part Twelve requires
-- permanence - "once disclosed, an allergy becomes a hard, permanent exclusion,
-- never suggested again", with no softening over time. Enforcing that by
-- convention would mean trusting every future code path not to offer a tidy-up;
-- enforcing it by simply never writing a delete makes the guarantee structural.
-- The one exception is account deletion, which reaches this table through the
-- same cascade as everything else - erasing someone's account must not leave
-- their medical data behind.
--
-- WHAT THIS DOES NOT DO. Part (c) of item 42 - a genuine executed filter on
-- every food suggestion path - is NOT delivered by this migration and is not
-- delivered anywhere yet. There is no structured food-suggestion path in the app
-- to gate: the Meal/Order Advisor is build item 22 and unbuilt. Storage and
-- capture are its prerequisites, not the guarantee itself, and nothing should
-- read this table's existence as meaning the gate is in place.
create table allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The allergen in the person's own words, normalised only for case and
  -- whitespace. Deliberately free text and not a closed list: principle 13, and
  -- a fixed enum of allergens is a list nobody can finish writing.
  name text not null,
  -- When it was first disclosed. Never updated, so the record shows when the
  -- app learned this rather than when a row was last touched.
  disclosed_at timestamptz not null default now(),
  -- The message it came from, kept because an allergy captured in passing is
  -- worth being able to check back on if the extraction ever looks wrong.
  raw_input text,
  created_at timestamptz not null default now(),
  -- One row per allergen per person. A second mention is not a second allergy,
  -- and the capture path relies on this to stay idempotent.
  unique (user_id, name)
);

create index allergies_user_idx on allergies (user_id);

alter table allergies enable row level security;

-- Matches every other table's policy shape. Note this grants delete at the
-- database level, as `for all` does throughout this schema - the permanence
-- guarantee is that no application code ever issues one, plus account deletion
-- which must be able to.
create policy "manage_own" on allergies for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
