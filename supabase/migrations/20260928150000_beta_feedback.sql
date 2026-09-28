-- BETA FEEDBACK (2026-09-28). Applied via the management API the same day.
-- Separate from feedback_reports: that one is for anybody and outlives the beta;
-- this carries a screenshot, a feeling and a status a tester can see, and ends
-- with the beta. NOTHING IS REQUIRED, so every content column is nullable.
create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  message text,
  screenshot_path text,
  feelings text[] not null default '{}',
  feeling_other text,
  question text,
  screen text,
  app_version text,
  update_id text,
  device text,
  platform text,
  os_version text,
  status text not null default 'sent' check (status in ('sent', 'read', 'fixed')),
  note text
);
alter table public.beta_feedback enable row level security;
drop policy if exists "own beta feedback is readable" on public.beta_feedback;
create policy "own beta feedback is readable"
  on public.beta_feedback for select using (auth.uid() = user_id);
drop policy if exists "own beta feedback is writable" on public.beta_feedback;
create policy "own beta feedback is writable"
  on public.beta_feedback for insert with check (auth.uid() = user_id);
create index if not exists beta_feedback_user_idx on public.beta_feedback (user_id, created_at desc);
create index if not exists beta_feedback_triage_idx on public.beta_feedback (status, created_at desc);

insert into storage.buckets (id, name, public) values ('beta-feedback', 'beta-feedback', false)
on conflict (id) do nothing;
drop policy if exists "own beta screenshots are readable" on storage.objects;
create policy "own beta screenshots are readable" on storage.objects for select
  using (bucket_id = 'beta-feedback' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own beta screenshots are writable" on storage.objects;
create policy "own beta screenshots are writable" on storage.objects for insert
  with check (bucket_id = 'beta-feedback' and (storage.foldername(name))[1] = auth.uid()::text);
