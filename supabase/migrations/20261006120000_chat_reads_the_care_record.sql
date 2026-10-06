-- THE CARE RECORD, READ BY THE MODEL THAT ANSWERS (Ruth, 6 October 2026).
--
-- Her instruction: "In the data it must still be separate: its own kind, its own
-- context block and its own description to the model (the facts I need to get
-- care)." This is the context block.
--
-- WHAT IT FIXES. A consultant letter was saved as a Me card, and the prompt
-- describes Me as "their personal protocol - the standing decisions about how
-- they are trying to live: supplements, skincare, a dietary decision, a
-- routine". So a hospital number sat beside her evening skincare on a shelf the
-- model had been told holds lifestyle choices, and the question she actually
-- asked for by name - "I've been having weird symptoms in x again, can you
-- remind me how to get seen?" - had nothing framed as a health record to answer
-- from.
--
-- This is the same fault as the saturated fat, one shelf along: the data was
-- captured correctly and the model was told it was something else.
--
-- WHY IT IS SELECTED SEPARATELY AND NOT FILTERED OUT OF meRows. Because the
-- description is the point. meRows arrives under a heading about how she lives;
-- these need their own heading saying what they are for, and a row that has to
-- be sorted out of a list by the model is a row the model can mis-sort.
--
-- THE SAME COLUMNS AS meRows, because it is the same card shape - title,
-- content, section, status - written by the same offer-and-yes path.

do $outer$
declare
  def text;
  oldblock text;
  newblock text := $block$    'careRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select title, content, category, status, created_at
        from almanac_entries
        where kind = 'care' and status = 'active'
        order by created_at desc
        limit 40
      ) t
    ), '[]'::jsonb),
    'meRows', coalesce((
$block$;
  startpos int;
  endpos int;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;
  if position('careRows' in def) > 0 then raise notice 'already present'; return; end if;

  startpos := position($anchor$    'meRows', coalesce(($anchor$ in def);
  if startpos = 0 then raise exception 'meRows block not found'; end if;

  oldblock := $anchor$    'meRows', coalesce(($anchor$;
  def := replace(def, oldblock, newblock);
  execute def;
end
$outer$;
