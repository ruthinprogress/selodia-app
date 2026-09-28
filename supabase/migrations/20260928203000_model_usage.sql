-- WHAT EACH MODEL CALL COST, PER USER, PER TURN (2026-09-28).
--
-- The pricing document rests on an invented user mix and on one person's
-- conversations. Every Anthropic response already carries its usage and the
-- route logged it to the console and threw it away. This keeps it.
--
-- Tokens AND cost, both. The tokens are the fact; the cost is that fact priced
-- at the rates of the day. Storing only tokens would silently re-price last
-- quarter every time Anthropic changes a number. See app/lib/model-cost.ts.
create table if not exists public.model_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- The chat_messages row this call belongs to, where there is one. A roundup
  -- has no turn, so this is nullable rather than faked.
  turn_id uuid,
  call text not null check (call in (
    'classify',   -- the conduct call, ~80% of a turn
    'reply',      -- the writer, on both outcomes: a fallback is paid for too
    'extraction', -- Haiku, parsing a logged food, activity or measurement
    'allergy',    -- layer 4 of the allergy gate, only on turns that reach it
    'roundup',    -- once a week, no turn attached
    'image',      -- a photographed meal
    'report'      -- a clinical document or summary, occasional and not per-turn
  )),
  model text not null,
  input_tokens integer not null,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  output_tokens integer not null,
  -- Micro-cents, as an integer. A turn is about 1.8 cents, so cents would round
  -- most calls to zero and a float accumulates error over a million rows.
  -- NULL means the model was not in the rate card - which is a gap to find, and
  -- deliberately not a zero, because a zero reads as a free call.
  cost_micro_cents bigint,
  created_at timestamptz not null default now()
);

-- The two questions this table exists to answer: what does one user cost, and
-- what did a given day cost.
create index if not exists model_usage_user_created_idx
  on public.model_usage (user_id, created_at desc);

alter table public.model_usage enable row level security;

-- NO POLICY AT ALL, AND THAT IS THE POLICY. Nothing on a phone needs to read
-- this and nothing on a phone writes it - the route writes with the service
-- role, which bypasses RLS. A table with RLS on and no policy is closed to
-- every client key, which is the state this wants.
--
-- The waitlist taught the other half of this lesson on the same day: a
-- permission set correctly against strangers also locked out the person the
-- data was for. So the reader exists before the table does -
-- scripts/cost-per-user.mjs - rather than being discovered as missing in a
-- month. See mobile/DECISION_PATTERNS.md.
--
-- The call kinds were widened the same evening (migration model_usage_call_kinds)
-- once the per-turn calls were counted properly: the allergy gate's layer 4 is
-- a Sonnet call on the turns that reach it, and the report writer is a real
-- cost that simply is not per-turn.
