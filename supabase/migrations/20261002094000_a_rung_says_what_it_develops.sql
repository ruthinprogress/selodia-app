-- WHAT A RUNG DEVELOPS, AND HOW TO BREATHE THROUGH IT.
--
-- Ruth approved the muscle-up ladder on 1 October, in
-- "2026-10-01 For Claude Code - approved wording and onboarding findings".
-- Her wording separates three things the schema only had one column for:
--
--   Why:      why this step is here           -> already stored as `detail`
--   Develops: what it builds                  -> NEW, `develops`
--   Add:      "Breathe out as you pull."      -> NEW, `cue`
--
-- They were being folded into `detail` as one paragraph, which loses her
-- distinction and means the Skills screen cannot lay them out differently. A
-- rung's "why" is a reason and its "develops" is an outcome; she wrote them
-- apart on purpose.
--
-- THE BREATHING LINE IS NOT A RULE, and this is the column that keeps it from
-- becoming one. Her note: "This is guidance for HOW to do a move. It is not a
-- Rule. It excludes nothing and must NOT be written to user_rules." Stored on
-- the rung it belongs to, it cannot reach the rules gate - which excludes
-- movements and would have quietly removed every exercise mentioning a breath.
--
-- `ladder_note` is the whole-ladder version of the same thing: "keep breathing
-- through every rep. Breathe out on the effort. Do not hold your breath or bear
-- down." It applies to every rung, so it is stored once on the skill.

alter table user_skill_rungs
  add column if not exists develops text,
  add column if not exists cue text;

alter table user_skills
  add column if not exists ladder_note text;

comment on column user_skill_rungs.develops is
  'What this rung builds, in her words. Shown under the why. Never a prediction.';
comment on column user_skill_rungs.cue is
  'How to perform it, e.g. a breathing cue. GUIDANCE, NEVER AN EXCLUSION: this '
  'must not be copied into user_rules, which is where exclusions live.';
comment on column user_skills.ladder_note is
  'One note that applies to every rung of this ladder. Guidance, not a rule.';
