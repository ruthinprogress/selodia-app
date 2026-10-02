-- A WEIGH-IN WITH NO LABEL IS STILL A WEIGH-IN, AND IT IS STILL TODAY'S.
--
-- `current_weight` ranked every row marked 'measured' above every row that was
-- not, and only then by date. The intent was right and documented: "a real
-- weigh-in always beats a guess." The implementation treated NULL - meaning
-- nobody recorded where the number came from - as though it were a guess.
--
-- WHAT THAT DID TO RUTH. Her weigh-ins of 1 and 2 October were logged through
-- chat and carry no weight_source. Her last row explicitly marked 'measured' is
-- 56 kg from 29 September. So on 2 October the goals screen worked her calorie
-- and protein targets from a FOUR-DAY-OLD weight, while Today read the latest row
-- directly and used 56.55 - two surfaces, two weights, the same shape as the two
-- protein targets she photographed this morning.
--
-- ONLY AN EXPLICIT 'estimate' IS DEMOTED NOW. That is the case the rule was
-- written for: somebody who said "about 57 kg" during setup should not outrank a
-- reading off the scales. An unlabelled row is not that - it is an entry whose
-- provenance nobody wrote down, and the honest default for it is the date it
-- carries, because it is far likelier to be a real weigh-in than a guess.
--
-- Fixing this also closes the gap between the view and the direct read: the view
-- now returns the same latest row the Overview already uses.

create or replace view public.current_weight
with (security_invoker = true) as
select user_id,
       weight_kg,
       weight_source,
       coalesce(measured_at, created_at) as as_of
from (
  select body_measurements.user_id,
         body_measurements.weight_kg,
         body_measurements.weight_source,
         body_measurements.measured_at,
         body_measurements.created_at,
         row_number() over (
           partition by body_measurements.user_id
           order by
             case when body_measurements.weight_source = 'estimate' then 1 else 0 end,
             coalesce(body_measurements.measured_at, body_measurements.created_at) desc
         ) as rn
  from body_measurements
  where body_measurements.weight_kg is not null
) ranked
where rn = 1;
