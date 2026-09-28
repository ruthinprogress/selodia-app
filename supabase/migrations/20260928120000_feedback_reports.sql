-- SOMEWHERE FOR A REPORT TO LAND THAT IS NOT A CHAT THREAD (2026-09-28).
-- Applied via the management API the same day; kept here so the repo and the
-- database agree, which is a standing gap this project has been closing.
-- See mobile/src/app/settings/feedback.tsx for what writes to it and why the
-- build context is collected automatically.
create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  message text not null,
  screen text,
  update_id text,
  runtime_version text,
  channel text,
  platform text,
  os_version text,
  app_version text,
  status text not null default 'new' check (status in ('new', 'seen', 'fixed', 'wont_fix')),
  note text
);

alter table public.feedback_reports enable row level security;

drop policy if exists "own feedback is readable" on public.feedback_reports;
create policy "own feedback is readable"
  on public.feedback_reports for select using (auth.uid() = user_id);

drop policy if exists "own feedback is writable" on public.feedback_reports;
create policy "own feedback is writable"
  on public.feedback_reports for insert with check (auth.uid() = user_id);

create index if not exists feedback_reports_triage_idx
  on public.feedback_reports (status, created_at desc);
