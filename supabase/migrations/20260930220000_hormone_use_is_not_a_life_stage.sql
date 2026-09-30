-- WHAT SHE IS TAKING IS NOT WHERE SHE IS.
--
-- Ruth, 30 September 2026, reviewing the Body Manual Setup architecture. Her
-- draft put hormonal contraception and HRT in the same mutually exclusive list
-- as perimenopause and post-menopause. My note, which she accepted: those are
-- interventions, not stages, and somebody can be both - perimenopausal AND on
-- HRT is the common case in this audience.
--
-- The app half knew this already: `hrt` has always been its own column, asked
-- separately, "so a monthly bleed on sequential HRT is not read as a cycle".
-- What it has never asked about is CONTRACEPTION, and that leaves the identical
-- error unhandled one door along:
--
--   a withdrawal bleed on the combined pill is not a natural cycle either.
--
-- So a woman on the pill answering "regular periods" - which is what she would
-- answer, and it is true as she experiences it - has every bleed read by this
-- app as evidence of a cycle it can reason from. Same class of mistake as the
-- HRT one, same consequence, and nothing has ever asked the question.
--
-- MULTI-SELECT, stored as a jsonb array, because the answers genuinely combine.
-- `hrt` stays as it is and is kept in step, so everything that reads it keeps
-- working and nothing has to be migrated in a hurry.
--
-- Reversible: alter table public.user_profile drop column hormone_use;

alter table public.user_profile add column if not exists hormone_use jsonb;

comment on column public.user_profile.hormone_use is
  'What she is taking or using, as an array: hormonal_contraception, hrt, neither, prefer_not_to_say. NOT a life stage - see the migration that added it. user_profile.hrt is kept in step for the readers that predate this.';
