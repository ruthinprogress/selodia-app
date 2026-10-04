-- THE SWITCHES SHE TICKED ARE THE RECORD (4 October 2026).
--
-- Ruth's final rules make two states differ that the stored columns cannot tell
-- apart:
--
--   Build muscle alone     a small surplus, 5% of what she uses
--   Maintain + Build       around what she uses
--
-- Both store fat=maintain, muscle=increase. Two columns cannot carry three
-- weight answers plus "nothing said", and until now the reader guessed - which
-- dropped her Maintain tick on reload earlier the same evening.
--
-- SO THE SWITCHES ARE STORED AS THEMSELVES. body_mode holds exactly what she
-- ticked; the two focus columns stay, written from it, because turn_context, the
-- day sums, the protein rule and every probe and parity check read them. One
-- record, derived views, nothing inferred.
--
-- NULL IS STILL "NOTHING CHOSEN", and that distinction is already live: one of
-- the three accounts has null in both focus columns today and correctly gets no
-- calorie figure at all. body_mode null means the same thing, so an account that
-- has never answered reads identically through either door.

alter table public.user_profile
  add column if not exists body_mode jsonb;

comment on column public.user_profile.body_mode is
  'Exactly what she ticked: {loseFat, maintainWeight, gainWeight, buildMuscle}. '
  'Null means nothing chosen, which is NOT the same as maintaining. '
  'fat_focus_state and muscle_focus_state are derived from this and kept in step; '
  'this is the record, they are the view. See mobile/src/lib/body-mode.ts.';

-- Backfilled from the focus columns so nobody loses their goal. The one case it
-- cannot recover is maintain/increase, which might have been either state - it
-- becomes Maintain + Build, the answer that does NOT add calories, because
-- quietly feeding somebody a surplus they did not ask for is the worse mistake.
update public.user_profile
set body_mode = jsonb_build_object(
      'loseFat', fat_focus_state = 'reduce',
      'maintainWeight', fat_focus_state = 'maintain',
      'gainWeight', fat_focus_state = 'increase',
      'buildMuscle', muscle_focus_state = 'increase'
    )
where body_mode is null
  and fat_focus_state is not null
  and muscle_focus_state is not null;

-- Her one Pause, which is not a goal and so is not in body_mode.
alter table public.user_profile
  add column if not exists paused_at timestamptz;

comment on column public.user_profile.paused_at is
  'When she tapped Pause, or null. Pause holds every combination at what her body '
  'uses without changing body_mode, so Resume is simply this going null. No timer '
  'reads it and nothing expires it - the date is for showing her, not for acting on.';
