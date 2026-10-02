-- CHAT CAN SEE HER SKILLS.
--
-- WHY. Ruth told chat "I want to learn to pull up to muscle up". It answered
-- that her Park / calisthenics slot already covered it, and after "Ok" said
-- "It's already sitting there in your week." Nothing was saved. The server did
-- not read user_skills, did not write to it, and had no save type for a skill -
-- so there was no true answer available and the model substituted the nearest
-- thing it could see, which was her week.
--
-- READ IN THE SAME MIGRATION AS THE WRITE, which is the standing rule after
-- four instances of collected, stored, and read by nobody in one week (the Me
-- cards, life_stage and hrt, the calcium column, and the whole of user_week).
-- Chat gained the ability to WRITE a skill in this same commit. Shipping that
-- without the read would reproduce the week's bug of 1 October precisely: able
-- to add a thing, and then unable to say it is there.
--
-- WHY A DO BLOCK RATHER THAN THE WHOLE FUNCTION AGAIN. turn_context is 7KB and
-- every previous change re-pasted all of it, which is how a key gets dropped by
-- transcription - and there is nothing to catch it, because a missing key reads
-- as an empty list rather than an error. This inserts one block into whatever is
-- actually deployed and leaves the rest untouched. It is idempotent: it does
-- nothing if skillRows is already there.
--
-- RUNGS COME WITH THE SKILL, not as a second top-level key. A ladder read apart
-- from its destination is a list of exercises; the whole point of Skills is that
-- the exercises have somewhere they are going.
--
-- `cue` IS GUIDANCE AND NOT A RULE. It carries Ruth's breathing lines. Rules
-- remove movements from what gets built for her; "breathe out as you pull" must
-- never reach user_rules, which is why it lives on the rung.

do $outer$
declare
  def text;
  anchor text := $anchor$    'allergies', coalesce(($anchor$;
  block text := $block$    -- WHAT SHE WANTS TO BECOME ABLE TO DO. New on 2 October 2026.
    --
    -- Chat told Ruth a muscle up was "already sitting there in your week" and
    -- saved nothing, because the server could neither read nor write a skill.
    -- Writing one without reading it back would repeat the week's mistake of
    -- 1 October exactly: able to add a thing, and then unable to say it is there.
    --
    -- Rungs come WITH the skill rather than as a second key, because a ladder
    -- read apart from its skill is a list of exercises with no destination.
    'skillRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select s.name, s.ladder_key, s.ladder_note,
               coalesce((
                 select jsonb_agg(to_jsonb(r)) from (
                   select name, stage, target, needs, detail, develops, cue
                   from user_skill_rungs
                   where skill_id = s.id
                   order by sort_order asc
                 ) r
               ), '[]'::jsonb) as rungs
        from user_skills s order by s.sort_order asc, s.created_at asc
      ) t
    ), '[]'::jsonb),
$block$;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'turn_context';

  if def is null then raise exception 'turn_context not found'; end if;
  if position('skillRows' in def) > 0 then raise notice 'already present'; return; end if;
  if position(anchor in def) = 0 then raise exception 'anchor not found'; end if;

  def := replace(def, anchor, block || anchor);
  execute def;
end
$outer$;
