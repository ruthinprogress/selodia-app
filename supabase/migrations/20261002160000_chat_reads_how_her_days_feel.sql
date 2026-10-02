-- CHAT READS HOW SHE WANTS HER DAYS TO FEEL.
--
-- Ruth, item 7: "Chat reads feel goals and the latest look-back as the guiding
-- source for tone and priorities, and NEVER PROMISES TO FIX ANYTHING."
--
-- READ IN THE SAME COMMIT AS THE WRITE. Standing rule here after five instances
-- of collected, stored, and read by nobody in one week. A feel goal the model
-- cannot see is a question that cost her a minute and changed nothing, which is
-- precisely what her own rule for setup forbids - and it is the first question in
-- the flow, so it would have been the first thing the app ignored.
--
-- THE LATEST LOOK-BACK ONLY, NOT A HISTORY. A list of past answers in front of
-- the model is a trend, and a trend on how somebody's days feel is a judgement
-- dressed as data. One answer says where she is now, which is all the tone needs.
--
-- A DO BLOCK, NOT A RE-PASTE OF 7KB. turn_context now carries goalRows, weekRows,
-- skillRows and these two; every previous change re-pasted the whole function,
-- which is how a key gets dropped by transcription with nothing to catch it - a
-- missing key reads as an empty list rather than an error. Idempotent.

do $outer$
declare
  def text;
  anchor text := $anchor$    'allergies', coalesce(($anchor$;
  block text := $block$    -- HOW SHE WANTS HER DAYS TO FEEL, and her last look-back. Item 7,
    -- 2 October 2026.
    --
    -- Ruth: "Chat reads feel goals and the latest look-back as the guiding source
    -- for tone and priorities, and NEVER PROMISES TO FIX ANYTHING."
    --
    -- Read in the same migration as the write, which is the standing rule here
    -- after five instances of collected, stored, and read by nobody. A feel goal
    -- the model cannot see is a question that cost her a minute and changed
    -- nothing - exactly what her rule for setup forbids.
    --
    -- THE LATEST LOOK-BACK ONLY, not a history. A list of past answers in front of
    -- the model is a trend, and a trend on how somebody's days feel is a judgement
    -- dressed as data. One answer says where she is now, which is all the tone
    -- needs.
    'feelRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select label, source, started_at
        from feel_goals
        where archived_at is null
        order by sort_order asc
      ) t
    ), '[]'::jsonb),
    'feelLookback', (
      select to_jsonb(t) from (
        select answer, note, created_at
        from feel_lookbacks
        order by created_at desc
        limit 1
      ) t
    ),
$block$;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;
  if position('feelRows' in def) > 0 then raise notice 'already present'; return; end if;
  if position(anchor in def) = 0 then raise exception 'anchor not found'; end if;

  def := replace(def, anchor, block || anchor);
  execute def;
end
$outer$;
