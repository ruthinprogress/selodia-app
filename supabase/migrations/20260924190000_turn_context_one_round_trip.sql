-- Everything a turn needs to know, in one round trip.
--
-- WHY. The route sent twenty separate reads before it could call the model.
-- They already ran in parallel, so on paper they cost whatever the slowest one
-- cost - about 127ms, measured individually against this database from London.
-- In production the phase measured two to four seconds.
--
-- The reason is geography. The function executes in Washington DC and this
-- database is in London, so every one of those twenty reads crossed the
-- Atlantic. Parallel does not help as much as it looks: each connection pays
-- its own TLS handshake, which is two more crossings, and twenty of them do
-- not fit on one connection. Vercel's free plan pins the function to a single
-- region we cannot choose, so the distance is fixed and the only thing left to
-- change is how many times we travel it.
--
-- Twenty crossings become one.
--
-- SECURITY INVOKER, WHICH IS THE WHOLE POINT. This runs as the caller, so every
-- row-level policy applies exactly as it does when the route reads these tables
-- itself, and auth.uid() is the person holding the token. It is not a way round
-- RLS and must never become one: a definer version of this function would hand
-- any signed-in person everybody's rows.
--
-- IT RETURNS RAW ROWS, NOT PROMPT TEXT. The wording that goes to the model stays
-- in TypeScript where it can be read and tested. This moves the fetching and
-- nothing else - the same split as loadDayStateRows and buildDayState.

create or replace function public.turn_context(
  p_since timestamptz,
  p_day_start timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(

    -- Only safety-classified turns carry escalation state, so pure logging
    -- turns are skipped - a food log dropped mid-escalation must not null out
    -- an active ladder by being the most recent assistant row.
    'lastAssistantTurn', (
      select to_jsonb(t) from (
        select classification, escalation_step, distress_revisit_count
        from chat_messages
        where user_id = auth.uid() and source = 'chat' and role = 'assistant'
          and classification is not null
        order by created_at desc limit 1
      ) t
    ),

    -- Descending then reversed in TypeScript, as before: ascending with a limit
    -- would take the OLDEST forty and silently drop the turn just inserted.
    'recentHistory', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select role, content
        from chat_messages
        where user_id = auth.uid() and source = 'chat'
        order by created_at desc limit 40
      ) t
    ), '[]'::jsonb),

    'contextRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select * from user_context order by category asc
      ) t
    ), '[]'::jsonb),

    'recentFood', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select happened_at, raw_text, kcal, protein_g
        from food_logs where happened_at >= p_since
        order by happened_at desc
      ) t
    ), '[]'::jsonb),

    'recentActivity', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select happened_at, activity_type, duration_min, kcal_burned,
               eccentric_load, intensity
        from activity_logs where happened_at >= p_since
        order by happened_at desc
      ) t
    ), '[]'::jsonb),

    'recentDailyBurn', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select date, steps, kcal_burned, active_kcal, active_minutes, distance_km
        from daily_activity_summaries where date >= p_since::date
        order by date desc
      ) t
    ), '[]'::jsonb),

    'recentDrinks', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select ml, happened_at
        from hydration_logs where happened_at >= p_since
        order by happened_at desc
      ) t
    ), '[]'::jsonb),

    'recentSleep', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select night_of, duration_min, quality, awakenings
        from sleep_logs where night_of >= p_since::date
        order by night_of desc
      ) t
    ), '[]'::jsonb),

    'recentMeasurements', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select measured_at, weight_kg, body_fat_pct
        from body_measurements where measured_at >= p_since
        order by measured_at desc
      ) t
    ), '[]'::jsonb),

    'healthContextRow', (select to_jsonb(t) from (select * from health_context limit 1) t),

    'lastPeriodRow', (
      select to_jsonb(t) from (
        select event_date from cycle_events
        where event_type = 'period_start'
        order by event_date desc limit 1
      ) t
    ),

    'yesterdaySummary', (
      select to_jsonb(t) from (
        select summary_date, mediating_factor from daily_summaries
        where mediating_factor is not null
        order by summary_date desc limit 1
      ) t
    ),

    'profileRow', (
      select to_jsonb(t) from (
        select height_cm, unsafe_goal_flagged_at, date_of_birth, biological_sex,
               activity_level, fat_focus_state, muscle_focus_state, protein_target_g,
               pending_fat_focus, pending_muscle_focus, pending_focus_asked_at,
               fat_focus_since, muscle_focus_since, consolidation_offered_at,
               lite_mode_since, pending_save, pending_save_asked_at
        from user_profile limit 1
      ) t
    ),

    'allergies', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select name, disclosed_at from allergies order by disclosed_at asc
      ) t
    ), '[]'::jsonb),

    'planRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select id, title, content from almanac_entries
        where user_id = auth.uid()
        order by created_at desc limit 50
      ) t
    ), '[]'::jsonb),

    'insightRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select kind, title, created_at from almanac_entries
        where user_id = auth.uid() and kind in ('symptom', 'insight')
        order by created_at desc limit 15
      ) t
    ), '[]'::jsonb),

    'meRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select title, category, content from almanac_entries
        where user_id = auth.uid() and kind = 'me'
      ) t
    ), '[]'::jsonb),

    'pendingCardRow', (
      select to_jsonb(t) from (
        select id, image_path from chat_messages
        where user_id = auth.uid() and source = 'chat'
          and image_path is not null and image_sent_to_model = false
        order by created_at desc limit 1
      ) t
    ),

    -- The two the day state is worked out from. The arithmetic stays in
    -- buildDayState, which needs the profile and nothing from the database.
    'dayFood', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select kcal, protein_g from food_logs where happened_at >= p_day_start
      ) t
    ), '[]'::jsonb),

    'latestMeasurement', (
      select to_jsonb(t) from (
        select weight_kg, body_fat_pct, bmr from body_measurements
        order by measured_at desc limit 1
      ) t
    )
  );
$$;

revoke all on function public.turn_context(timestamptz, timestamptz) from public;
grant execute on function public.turn_context(timestamptz, timestamptz) to authenticated;
