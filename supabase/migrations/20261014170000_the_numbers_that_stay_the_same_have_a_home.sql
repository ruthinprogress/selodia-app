-- THE NUMBERS THAT STAY THE SAME HAVE A HOME (14 October 2026).
--
-- Ruth: "It might be useful to populate a section where the pertinent details
-- always live as they come in from the user, stuff that usually stays the same
-- like NHS numbers, axa memebership numbers etc etc. easy to access for the
-- user." And, settling the shape: "So each thread of accessing care stays in
-- the current format with everything needed for it, and then the constants are
-- in their own section."
--
-- Until now a reference existed only as a line of TEXT inside one care record,
-- under a "To quote" heading. That is right for the record - the referral needs
-- its own number on it - and useless for the one thing she actually does with
-- an NHS number, which is read it out to somebody waiting on the phone. It
-- meant opening a letter, scrolling past what was agreed, and reading a line
-- out of a paragraph. The same number appeared in four records with no way to
-- know they were the same number.
--
-- ONE ROW PER LABEL, ENFORCED HERE AND NOT IN A PROMPT. label_key is the
-- normalised label - "NHS no.", "NHS Number" and "nhs number" all key to "nhs
-- number" - and the unique index means a restatement UPDATES the value rather
-- than adding a second copy. A constant with two live values is worse than no
-- constant at all, because she cannot tell which one the desk wants. The guard
-- belongs at the write: the model is told what a constant is once, and the
-- database is what makes it true.
--
-- WHAT IT IS NOT: not a form. Nothing here is ever asked for on a screen. A row
-- arrives because a letter was read or because she said a number in chat, which
-- is the same way everything else in this app arrives.

create table if not exists public.care_constants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What it is called, in the words it arrived in: "NHS number", "AXA
  -- membership number", "Hospital number". Shown as given.
  label text not null,
  -- The same label, normalised, so the index can hold one row per thing.
  label_key text not null,
  -- The number itself, kept EXACTLY as written, spacing and all: "485 777 3456"
  -- is how it appears on the card she is reading from, so it is how it is
  -- stored and how it is shown back.
  value text not null,

  -- Where it is used, when that is not obvious from the label - "for the knee
  -- referral", "quote this when booking". One short line, optional.
  note text,

  -- 'document' when it came off a letter that was read, 'conversation' when she
  -- said it. Shown as provenance, because a number she typed and a number a
  -- camera read deserve different amounts of trust.
  source text not null default 'conversation' check (source in ('document', 'conversation')),
  -- false ONLY when the two reads of a photographed document disagreed about
  -- the digits, matching the same flag on a care record's references.
  confirmed boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists care_constants_one_per_label
  on public.care_constants (user_id, label_key);

create index if not exists care_constants_by_user
  on public.care_constants (user_id, updated_at desc);

alter table public.care_constants enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'care_constants' and policyname = 'own care constants'
  ) then
    create policy "own care constants" on public.care_constants
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.care_constants is
  'The details that stay the same - NHS number, insurer membership, hospital number - lifted out of individual care records so they can be read without opening a letter. One row per label, per person.';
