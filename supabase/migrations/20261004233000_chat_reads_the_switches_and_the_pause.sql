-- CHAT READS THE SWITCHES, THE PAUSE, AND THE MACROS SHE SWITCHED ON.
--
-- Ruth, 2 October 2026: "you should be able to talk to chat to explain what your
-- targets are made from and what the assumptions are - this is very important."
--
-- FOUR COLUMNS CHAT CANNOT SEE, and each one makes it quote a figure that is not
-- the figure on her phone:
--
--   body_mode              Build muscle alone is 5% over what she uses; Maintain
--                          + Build is not. Both store maintain/increase, so
--                          without this chat cannot tell them apart and reports
--                          the one that adds nothing.
--   paused_at              Pause holds everything at maintenance. Without this,
--                          she taps Pause on Today, asks chat what she should be
--                          eating, and is told her deficit figure.
--   activity_level_set_at  So "where does 1,550 come from" can answer with the
--                          day she chose her activity level, which is the single
--                          biggest term in it.
--   tracked_macros         ADDED TODAY AND ALREADY BROKEN BY THIS. She asked for
--                          a week of saturated fat, was told it was not tracked,
--                          and was not told she could switch it on. I built
--                          lib/tracked-macro-summary.ts to fix that and wired it
--                          to profile.tracked_macros - a key turn_context does
--                          not select, so it has been reading undefined since it
--                          shipped. Collected, stored, and read by nobody, for
--                          the sixth time this week and the first one I wrote
--                          myself in the same session as the complaint.
--
-- THAT IS WHY check-turn-context-reads-what-chat-casts.mjs EXISTS. The fault is
-- not any one missing column; it is that the cast in route.ts and the select in
-- here are two lists nothing compared. The check compares them.
--
-- A DO BLOCK, NOT A RE-PASTE OF 7KB, and idempotent - see the header on
-- 20261002160000_chat_reads_how_her_days_feel.sql for why.

do $outer$
declare
  def text;
  anchor text := $anchor$               life_stage, life_stage_detail, hrt, hormone_use$anchor$;
  wider text := $wider$               life_stage, life_stage_detail, hrt, hormone_use,
               body_mode, paused_at, activity_level_set_at, tracked_macros$wider$;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;
  if position('body_mode' in def) > 0 then raise notice 'already present'; return; end if;
  if position(anchor in def) = 0 then raise exception 'anchor not found'; end if;

  def := replace(def, anchor, wider);
  execute def;
end
$outer$;
