-- A HIGH PROTEIN TARGET ASSUMES SHE IS TRAINING, SO IT HAS TO BE ABLE TO KNOW.
--
-- Ruth, 2 October 2026: "The protein target (101-123g) assumes you're actively
-- resistance training to drive the recomp - without that stimulus, it's a
-- maintenance-range target in disguise. Flag when the user isn't currently
-- training (injury, pause, etc.) and show a lower maintenance protein range
-- instead, with a note that it steps up once training resumes."
--
-- WHY A COLUMN AND NOT A DERIVATION. The obvious move is to read it from her week
-- - strength rows present means training. It is wrong twice over. Her Week is
-- EMPTY by her own standing instruction, so a derivation would conclude she is
-- paused and quietly drop her target on the strength of a table I was told not to
-- fill. And `user_week` is a PLAN, not a log: there is no record anywhere of a
-- session actually done, so even a full week would be an intention being read as
-- evidence. The app does not know this fact. It has to be told it, and until it
-- is told it says out loud what it assumed.
--
-- NULL IS NOT A PAUSE. Null means she has not said, and the target steps up as
-- before with the assumption named on the figure. Treating silence as a pause
-- would mean choosing "less fat, more muscle" changed nothing about what the app
-- asked of her until she answered a question nobody had put to her - which is the
-- failure the protein step-up was built to fix in the first place.
--
-- 'paused' COVERS injury, illness, a break, a stretch of sedentary weeks. One
-- state rather than four, because what the arithmetic needs to know is only
-- whether there is a training stimulus, and asking her to categorise why would be
-- asking for her reasons in order to ignore them.

alter table public.user_profile
  add column if not exists training_state text;

alter table public.user_profile
  drop constraint if exists user_profile_training_state_check;

alter table public.user_profile
  add constraint user_profile_training_state_check
  check (training_state is null or training_state in ('training', 'paused'));

comment on column public.user_profile.training_state is
  'Whether she is currently training. Null means she has not said, which steps '
  'protein up with the assumption named rather than holding it back. Only '
  '''paused'' holds the recomposition/muscle-gain step-up at the maintenance '
  'range - it never goes below it. See mobile/src/lib/protein.ts.';

-- WHEN SHE LAST SAID SO, because "paused" with no date is a state that outlives
-- the pause. Nothing reads this to expire the state on its own - an app deciding
-- on her behalf that she must be training again by now would be inventing the
-- very fact this column exists to stop it inventing - but the Body Manual can
-- show her when she set it, which is what lets her notice it is stale.
alter table public.user_profile
  add column if not exists training_state_set_at timestamptz;
