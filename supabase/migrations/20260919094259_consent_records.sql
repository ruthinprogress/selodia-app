-- Consent, recorded (build item 51, "needed before beta"; built 2026-09-19).
--
-- The consent screen has always asked three things - core consent to process
-- health data (required), an updates opt-in and a de-identified research
-- opt-in - and until today stored none of them, for anyone. The privacy policy
-- names explicit consent as the basis for holding health and cycle data, which
-- is special category data under UK GDPR, and Article 7(1) requires the
-- controller to be able to DEMONSTRATE that consent was given.
--
-- APPEND-ONLY. A record of consent is evidence, and evidence that can be
-- edited is not evidence. A change of mind - withdrawing the research opt-in,
-- say - is a new row with its own time, so the history of what was agreed to,
-- and when, survives intact. Hence no update policy for users. (A delete-own
-- policy for erasure followed in erasure_and_export_completeness.)
-- Erasure still removes everything: the rows cascade with the account, as the
-- law requires and as Ruth confirmed on 12 September.
--
-- policy_version is the "Last updated" date of the privacy policy the answers
-- were given against, so a later change to the policy can be told apart from
-- consent to the earlier one.

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  core_consent boolean not null,
  marketing_opt_in boolean not null default false,
  research_opt_in boolean not null default false,
  policy_version text not null,
  -- 'onboarding' when given at sign-up, 'reconfirm' when an existing account
  -- was asked because nothing had been recorded.
  source text not null check (source in ('onboarding', 'reconfirm')),
  -- When the boxes were ticked, which on the email-confirmation path is earlier
  -- than when the row could be written.
  given_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);

create index if not exists consent_records_user_idx
  on public.consent_records (user_id, recorded_at desc);

alter table public.consent_records enable row level security;

create policy "consent_records_select_own" on public.consent_records
  for select using (auth.uid() = user_id);

create policy "consent_records_insert_own" on public.consent_records
  for insert with check (auth.uid() = user_id);
