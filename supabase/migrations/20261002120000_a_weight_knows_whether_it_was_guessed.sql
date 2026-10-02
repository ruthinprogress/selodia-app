-- A WEIGHT KNOWS WHETHER IT WAS GUESSED.
--
-- Ruth, 2 October 2026: "Add 'Roughly what do you weigh?' to the goal screen.
-- A guess is fine, no scales needed. Store weight with a SOURCE (estimate or
-- measured) and a DATE. The latest real weigh-in wins. The first real weigh-in
-- replaces an estimate and keeps the history."
--
-- WHY IT MATTERS RATHER THAN BEING TIDY. The calorie target for "lose fat" is
-- computed from bodyweight - 0.5% of it a week, converted to a daily figure - so
-- a guess that is five kilos out moves her target by about fifty calories. That
-- is acceptable, and it is only acceptable while everyone involved knows it was
-- a guess. Without this column an estimate and a scale reading are the same row,
-- the app cannot say "worked out from the weight you gave me", and a later real
-- weigh-in has no way to take precedence over a guess made weeks earlier.
--
-- THE SELECTION RULE IS "LATEST MEASURED, ELSE LATEST ESTIMATE", and it is
-- written once in lib/pick-weight.ts for both sides of the app. A measured
-- reading always beats an estimate however old the reading is, because a number
-- off a scale is a fact about her body and a guess is a starting point.
--
-- NOTHING IS DELETED. "Keeps the history" is the requirement: the estimate stays
-- as a row, it simply stops being the one the targets read. Her own rule from
-- the setup-redo bug of 1 October - a screen may not remove what it did not put
-- there - applies to her own past answers too.
--
-- EXISTING ROWS ARE 'measured'. Every row in this table today arrived from a
-- scale or a scale's app (source_app is set on them), which is what measured
-- means. Backfilling them as estimates would quietly demote a real reading.

alter table body_measurements
  add column if not exists weight_source text;

alter table body_measurements
  drop constraint if exists body_measurements_weight_source_check;
alter table body_measurements
  add constraint body_measurements_weight_source_check
  check (weight_source is null or weight_source in ('estimate', 'measured'));

-- Only rows that actually carry a weight get a source; a row recording a waist
-- measurement has no weight to describe.
update body_measurements
   set weight_source = 'measured'
 where weight_kg is not null and weight_source is null;

comment on column body_measurements.weight_source is
  'estimate (she guessed it, no scales) or measured (a real weigh-in). NULL on '
  'rows carrying no weight. lib/pick-weight.ts: latest measured wins, else '
  'latest estimate. An estimate is never deleted when a measurement arrives.';

-- WHICH WEIGHT THE TARGETS SHOULD USE, so chat and the server agree with the
-- phone without each re-deriving the rule.
create or replace view current_weight as
select
  user_id,
  weight_kg,
  weight_source,
  coalesce(measured_at, created_at) as as_of
from (
  select
    user_id, weight_kg, weight_source, measured_at, created_at,
    row_number() over (
      partition by user_id
      order by
        -- A real weigh-in outranks a guess, whatever the dates say.
        case when weight_source = 'measured' then 0 else 1 end,
        coalesce(measured_at, created_at) desc
    ) as rn
  from body_measurements
  where weight_kg is not null
) ranked
where rn = 1;

comment on view current_weight is
  'The weight the targets read: latest measured, else latest estimate. One row '
  'per user, or none when she has never given a weight.';

alter view current_weight set (security_invoker = on);
