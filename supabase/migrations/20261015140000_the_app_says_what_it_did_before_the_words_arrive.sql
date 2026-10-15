-- THE APP SAYS WHAT IT DID BEFORE THE WORDS ARRIVE (15 October 2026).
--
-- Ruth, choosing between three ways of making a turn feel shorter: "two-stage
-- reply". And ruling out the cheap one in the same breath: skipping the second
-- model call "is not an option as the majority of app usage will need it to
-- demonstrate premium price and also because it's literally what's building
-- what I want."
--
-- SO THE TURN DOES NOT GET SHORTER. It gets a first half.
--
-- A led turn is two model calls, 13.6s on average and 28.5s at worst, and the
-- measurement that matters is WHERE the useful information already exists.
-- Everything the app DID - what was logged, what was kept, what reminder was
-- set - is decided and written about seven seconds in, by the first call. The
-- remaining six or seven seconds are the second call writing prose about it.
-- Until now she watched a spinner through both halves and then received
-- everything at once.
--
-- This table is the first half, published the moment it is true. The phone
-- reads it and shows the confirmation - which is the thing she said she wanted
-- most on 14 October: "it's quite disconcerting if it says nothing for a log,
-- it's history. i like it best when it does a little table confirming what i
-- told it."
--
-- WHY A TABLE AND NOT A STREAMED RESPONSE. Streaming would be the elegant
-- answer and it would mean changing how every chat message travels, on the one
-- endpoint the whole app depends on, with no way to verify the result on her
-- phone before she uses it. This is additive: the existing response is
-- untouched, and a turn where nothing here works behaves exactly as it does
-- today. The phone already holds an authenticated client, so it reads this
-- directly and no new endpoint exists to go wrong either.
--
-- KEYED BY AN ID THE PHONE INVENTS, which is the only part that needs saying
-- twice. The phone cannot wait for the server to name the turn - the whole
-- point is to learn something before the server answers - so it generates the
-- id, sends it, and reads back the row with the same id.
--
-- IT HOLDS NOTHING THAT IS NOT ALREADY ON ITS WAY. Every field here appears in
-- the ordinary response a few seconds later. Nothing is decided here, nothing
-- is a source of truth, and a stage row that never arrives costs only the
-- early confirmation.

create table if not exists public.turn_stage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The id the PHONE generated for this turn, before it sent anything. Text
  -- rather than uuid on purpose: it comes off a client, it is never trusted
  -- for anything but matching a row back to the request that made it, and a
  -- malformed one should miss rather than raise.
  client_turn_id text not null,

  -- What the app did, in the same shape the final response uses for these
  -- fields: { summary, almanacTitle, foodLogId, reminder }. Nullable members
  -- throughout - most turns do one of these things, many do none.
  acted jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- ONE ROW PER TURN. The voice adapter's documented fallback runs a turn twice
-- when the first copy has not answered yet, and both copies would write here.
-- A second row would be harmless but the index says what is true.
create unique index if not exists turn_stage_one_per_turn
  on public.turn_stage (user_id, client_turn_id);

create index if not exists turn_stage_by_user
  on public.turn_stage (user_id, created_at desc);

alter table public.turn_stage enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'turn_stage' and policyname = 'own turn stages'
  ) then
    create policy "own turn stages" on public.turn_stage
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.turn_stage is
  'The first half of a turn: what the app DID, published the moment it is true rather than when the reply finishes being written. Read by the phone, keyed by an id the phone generated. Never a source of truth - everything here arrives again in the ordinary response.';
