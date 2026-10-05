-- CHAT READS A SKILL AS A PLAIN CARD, WITH HER NOTES (Ruth, 5 October 2026).
--
--   "CHAT adds and reads skills and notes as plain cards. It may talk about
--   practice in conversation but never builds or saves a ladder."
--
-- WHAT turn_context SENT UNTIL NOW: every skill with every rung under it - name,
-- stage, target, needs, detail, develops, cue. That is a ladder handed to the
-- model, and ladders are parked. It also sent nothing she had actually written,
-- because skill_notes did not exist until today.
--
-- SO THE SHAPE FOLLOWS THE CARD: her words, where she is with it, the date, and
-- her notes newest first. The rungs are not selected; user_skill_rungs is kept
-- and unread, the same as every other parked thing.

do $outer$
declare
  def text;
  oldblock text;
  newblock text := $block$    'skillRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select s.id, s.name, s.placement, s.created_at,
               coalesce((
                 select jsonb_agg(to_jsonb(n)) from (
                   select note, created_at
                   from skill_notes
                   where skill_id = s.id
                   order by created_at desc
                   limit 5
                 ) n
               ), '[]'::jsonb) as notes
        from user_skills s order by s.created_at desc
      ) t
    ), '[]'::jsonb),
$block$;
  startpos int;
  endpos int;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;
  if position('s.placement' in def) > 0 then raise notice 'already present'; return; end if;

  startpos := position($anchor$    'skillRows', coalesce(($anchor$ in def);
  if startpos = 0 then raise exception 'skillRows block not found'; end if;

  endpos := position($after$    'feelRows'$after$ in def);
  if endpos = 0 or endpos < startpos then
    endpos := position($after$    'weekRows'$after$ in def);
  end if;
  if endpos = 0 or endpos < startpos then raise exception 'cannot find the end of the skillRows block'; end if;

  oldblock := substr(def, startpos, endpos - startpos);
  def := replace(def, oldblock, newblock);
  execute def;
end
$outer$;
