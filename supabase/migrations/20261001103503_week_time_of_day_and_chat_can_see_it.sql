-- HER WEEK, READABLE BY CHAT, AND A TIME OF DAY TO READ.
--
-- Ruth, 1 October 2026: "I start a new class, like french class, and I want to
-- see it in the week because it blocks that evening availability for movement.
-- I tap plus and at the bottom of pre-existing activities I do, I can Text add.
-- But I can always discuss it with chat if I want to and it will know what it
-- is. I can also ask chat directly to add french class on thursday night at
-- 7pm."
--
-- Two gaps, and the second is the older and worse one.
--
-- 1. THERE WAS NOWHERE TO PUT "7pm". user_week had days, duration and cadence,
--    all of which answer how often and how long, and none of which answers when
--    in the day - which is the only thing that makes an evening unavailable.
--
--    TEXT, NOT time. "7pm", "evening", "after the school run" and "before work"
--    are all answers she might give, and only one of them is a clock time.
--    Parsing it into 19:00:00 would throw away the other three and gain nothing:
--    nothing sorts on this column and nothing alarms off it. It is read, shown
--    on the card, and spoken back in her own words.
--
-- 2. CHAT COULD NOT SEE HER WEEK AT ALL. turn_context is the single round trip
--    that builds everything the model is told, and it did not select user_week.
--    So Selodía has never been able to say what is in her week - and on 1
--    October, asked to "Add Gym to Plans weekly view on Wednesday", it offered
--    her Me tab instead and then told her the two were the same thing.
--
--    This is the FOURTH instance this week of collected, stored, and read by
--    nobody: the Me card contents, life_stage and hrt, the calcium column in the
--    CoFID import, and now the whole of user_week. It is a class of bug, not an
--    incident, and the rule that came out of it is a commit-level one - whatever
--    starts being stored gets read in the same commit.
--
--    Which is why the column and the read ship together here rather than in two
--    migrations: adding time_of_day without putting it in turn_context would be
--    the fifth instance, in the migration that documents the fourth.
--
-- WHAT IS NOT HERE: no completion column, no count, no "missed". user_week says
-- what she intends to do, activity_logs say what happened, and nothing joins
-- them into a score. The Witness Principle is load-bearing on this table.

alter table public.user_week add column if not exists time_of_day text;

comment on column public.user_week.time_of_day is
  'When in the day, in her own words. Text deliberately: "7pm", "evening" and '
  '"after the school run" are all valid. Nothing sorts or alarms on this.';

-- turn_context, unchanged except for the weekRows key. Replaced whole because
-- that is the only way Postgres takes it; the diff against
-- 20260930180137_turn_context_knows_life_stage is the weekRows block alone.
create or replace function public.turn_context(
  p_since timestamptz,
  p_day_start timestamptz
) returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'lastAssistantTurn', (
      select to_jsonb(t) from (
        select classification, escalation_step, distress_revisit_count
        from chat_messages
        where user_id = auth.uid() and source = 'chat' and role = 'assistant'
          and classification is not null
        order by created_at desc limit 1
      ) t
    ),
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
               lite_mode_since, pending_save, pending_save_asked_at,
               life_stage, life_stage_detail, hrt, hormone_use
        from user_profile limit 1
      ) t
    ),
    -- WHAT IS IN HER WEEK. New on 1 October 2026; see the header. Ordered the
    -- way the Week screen orders it, so what the model reads back to her is in
    -- the order she sees.
    'weekRows', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select activity, days, duration, cadence, time_of_day, purpose
        from user_week order by sort_order asc, created_at asc
      ) t
    ), '[]'::jsonb),
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
