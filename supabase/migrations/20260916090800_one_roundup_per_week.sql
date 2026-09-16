-- One weekly roundup per person per week, enforced by the database.
--
-- FOUND ON DEVICE 2026-09-16. The phone asks for the week's roundup at launch,
-- and the route checked "does this week already have one?" before writing. On a
-- real launch six requests went out together - the check fires from both the
-- session read and the auth listener, and the screen mounted more than once -
-- and all six passed the check before any of them had finished writing. Six
-- roundups for the same week, and six copies posted into her chat, in eight
-- seconds.
--
-- A check-then-write cannot make this promise; only a constraint can. The week
-- a roundup covers is stored on the entry as content->>'__weekEnding', so the
-- index is on that expression, and partial so it touches nothing else in the
-- table. The route treats a refused write as "somebody else wrote this week
-- first" and says nothing rather than posting a second copy.
--
-- Applied through the Supabase MCP as `one_roundup_per_week` and kept here too.
-- It would not build until the six duplicates were deleted, which is precisely
-- what it exists to prevent.
create unique index if not exists almanac_entries_one_roundup_per_week
  on almanac_entries (user_id, (content->>'__weekEnding'))
  where kind = 'roundup';
