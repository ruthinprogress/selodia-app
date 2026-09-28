-- WHO IS IN THE BETA, AND WHAT THEY AGREED TO (2026-09-28).
-- Applied via the management API the same day. See mobile/src/lib/beta.ts.
-- Two separate facts: membership (granted by Ruth) and acceptance (versioned,
-- append-only). A single boolean would have blurred the state the app must
-- handle - granted but not yet accepted - which exists because clause 13 says
-- pressing the button is what counts and carrying on using Selodia is not.
create table if not exists public.beta_members (
  user_id uuid primary key,
  granted_at timestamptz not null default now(),
  granted_reason text,
  wave text check (wave in ('zero', 'one', 'later')),
  ended_at timestamptz,
  ended_reason text
);
alter table public.beta_members enable row level security;
drop policy if exists "own beta membership is readable" on public.beta_members;
create policy "own beta membership is readable"
  on public.beta_members for select using (auth.uid() = user_id);

create table if not exists public.beta_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);
alter table public.beta_agreement_acceptances enable row level security;
drop policy if exists "own acceptances are readable" on public.beta_agreement_acceptances;
create policy "own acceptances are readable"
  on public.beta_agreement_acceptances for select using (auth.uid() = user_id);
drop policy if exists "own acceptances are writable" on public.beta_agreement_acceptances;
create policy "own acceptances are writable"
  on public.beta_agreement_acceptances for insert with check (auth.uid() = user_id);
create index if not exists beta_agreement_acceptances_user_idx
  on public.beta_agreement_acceptances (user_id, accepted_at desc);
