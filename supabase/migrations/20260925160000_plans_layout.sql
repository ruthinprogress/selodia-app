-- HER OWN ORDER FOR THE PLANS LIST (Ruth, 25 September 2026, item 6: "Make
-- sure all cards have been treated with the ability to be reordered and
-- deleted at the main menu page, eg, log, plans, etc.").
--
-- The third list to ask for this, after the Log rows and the Cycle cards, and
-- it reads through exactly the same rules - see lib/log-layout-rules.ts. A
-- saved id the list no longer has is ignored rather than leaving a hole; a plan
-- created after she arranged hers appears at the end rather than vanishing.
-- Both matter more here than on the other two, because the ids in this column
-- are HER PLANS: they come and go as she makes and deletes them, where the Log
-- rows are a fixed list the app ships.
--
-- NULLABLE, AND NOTHING BACKFILLED. No arrangement means the app's own order -
-- newest first - which is what everybody has today.

alter table public.user_profile
  add column if not exists plans_layout jsonb;
