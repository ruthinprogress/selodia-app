-- EVERY TIME THE NEW REPLY PATH FALLS BACK, AND WHY (2026-09-28).
-- Applied via the management API the same day. A console log lives in Vercel
-- where "how often is this happening?" cannot be answered; this can be counted.
create table if not exists public.reply_path_fallbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  at timestamptz not null default now(),
  reason text not null,
  detail text,
  voice boolean not null default false,
  turn_id uuid
);

alter table public.reply_path_fallbacks enable row level security;

drop policy if exists "own fallbacks are readable" on public.reply_path_fallbacks;
create policy "own fallbacks are readable"
  on public.reply_path_fallbacks for select using (auth.uid() = user_id);

create index if not exists reply_path_fallbacks_at_idx
  on public.reply_path_fallbacks (at desc);
