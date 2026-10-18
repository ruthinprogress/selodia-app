-- RUTH'S OWN COACHING, TRAVELLING WITH THE DRAWING.
--
-- The coaching notes have existed in scripts/illustration-progressions.mjs
-- since 16 October and in scripts/illustration-movements.mjs since today, and
-- NOTHING HAS EVER READ THEM. The only mention anywhere else is a comment in
-- the mobile component pointing at them as the source of its language. So the
-- most valuable content in the whole illustration project - the part that comes
-- from Ruth doing the movement rather than from anybody describing it - has
-- never reached a single user.
--
-- The same fault as the illustration brief earlier today: written down
-- carefully, imported by nothing. See scripts/check-illustration-prompt.mjs.
--
-- WHY IT LIVES BESIDE THE PICTURE RATHER THAN IN THE PLAN. A plan's how-to
-- steps are written per plan by the model and are about doing the movement. The
-- coaching is about the movement itself and is the same for everybody who ever
-- sees it: what to feel for, what changes when you alter something, and why the
-- picture's one fixed angle is not the target. It belongs to the drawing, so it
-- travels with it and cannot drift apart from it.
--
-- Her cossack note is the worked example, and it is not something a model would
-- write: "Coming out of it, shift your weight back to centre and then over to
-- the other side, into a side lunge and then the squat. As you pass through the
-- side lunge, pivot on the heel and let the toe rotate up. That is what lets the
-- knee bend further and the hip travel toward the floor."
alter table public.movement_illustrations
  add column if not exists coaching text;

comment on column public.movement_illustrations.coaching is
  'Ruth''s own note on the movement: what to feel for, and what changes when you alter something. Written from doing it, never generated. Shown under the picture.';
