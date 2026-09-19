import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HydrationQuickTap } from '@/components/hydration-quick-tap';
import { SettingsLink } from '@/components/settings-link';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useHealthFlower } from '@/hooks/use-health-flower';
import { useTheme } from '@/hooks/use-theme';
import { resolveTDEE } from '@/lib/body-metrics';
import { withoutDailySummaries } from '@/lib/daily-summary-rows';
import { calculateCalorieTarget, type FocusState } from '@/lib/calorie-target';
import { HealthFlower } from '@/components/health-flower';
import { hydrationLabel, hydrationToday } from '@/lib/hydration';
import { formatLogDate, toLocalDateKey } from '@/lib/week';
import {
  findWeekAgoReading,
  formatWeeklyDelta,
  gapDays,
  weeklyDelta,
  type MeasurementRow,
} from '@/lib/overview-metrics';
import { PERSONAL_LINE_DAY_ONE, pickDailyPersonalLine } from '@/lib/personal-line';
import { calculateProteinTarget, proteinTargetLabel } from '@/lib/protein';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { supabase } from '@/lib/supabase';
import { WhatYouBurn, type BurnFigures } from '@/components/what-you-burn';

// The Body tab's landing screen (rewritten 2026-09-03).
//
// Three sections, each headed by a tappable heading that IS the way into that
// section's detail. The heading does two jobs on purpose: a separate "see more"
// control would be a second thing to explain, and a heading that navigates is
// the pattern every settings screen on the phone already uses.
//
// NUMBERS, NOT BARS. The previous version drew calorie, protein and water as
// target-vs-current bars. A bar states a target as a thing to fill, and a
// half-empty one reads as a failure at a glance in a way "1,450" does not. The
// figures are the same; what has gone is the judgement drawn around them.
//
// NO SCROLLING. This screen is a glance, and a glance that scrolls is a screen.
// It renders in a plain View rather than the scroller the detail routes use, so
// there is nothing to scroll even if content grows. That is a constraint worth
// keeping: anything that will not fit here belongs in a detail screen.

type Metric = { value: number | null; delta: string | null };
type OverviewData = {
  hasMeasurement: boolean;
  // When the newest of the three body figures was taken. Null when there are no
  // readings at all. The three can come from different days, so this is the
  // latest of them rather than a date that is true of all three.
  bodyAsOf: string | null;
  personalLine: string;
  weight: Metric;
  muscle: Metric;
  // Only present with a bioimpedance reading behind it. Null means "this scale
  // does not measure that", which is a different thing from zero, and the
  // difference is the whole reason the figure is omitted rather than shown as a
  // dash: a 0% body fat reading would be alarming nonsense.
  bodyFat: Metric;
  todayKcal: number;
  todayProtein: number;
  calorieTargetKcal: number | null;
  proteinTargetLabel: string | null;
  activityCount: number;
  activityMinutes: number;
  // Today's steps from the phone's own health platform, or null when it has no
  // answer - a refusal, a phone without one, or a genuinely quiet morning that
  // cannot be told apart from either. Null renders nothing; it is never a zero,
  // because a zero is a claim that somebody has not moved.
  steps: number | null;
  hydrationMl: number;
  // Days since the last recorded period start, 1-based, or null when no cycle
  // has ever been logged. Read, never inferred: a cycle day guessed from an
  // average would be a number about somebody's body that nobody measured.
  cycleDay: number | null;
  // BMR and TDEE for the "What you burn" panel. Null when there is not enough
  // to compute them, which the panel says by showing nothing rather than a
  // dash: an estimate nobody can make is not a figure with a gap in it.
  burn: BurnFigures;
};

type ProfileRow = {
  height_cm: number | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  activity_level: string | null;
  fat_focus_state: string | null;
  muscle_focus_state: string | null;
  has_scales: boolean | null;
  protein_target_g: number | null;
  first_name: string | null;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;
const asFocus = (s: string | null): FocusState =>
  s === 'reduce' || s === 'increase' ? s : 'maintain';

// "Thursday 17 September", never 2026-09-17. Built by hand rather than through
// toLocaleDateString for the same reason week.ts is: Hermes on Android ships a
// variable ICU build, so the same call can return a different string on a
// different phone, and this one is read every morning.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayLabel(now: Date = new Date()): string {
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

// Morning, afternoon or evening, from the phone's own clock. No name unless one
// is stored: a greeting that guesses somebody's name is worse than one without.
//
// TWO LINES, DELIBERATELY (Ruth, 2026-09-18): "Good morning," then "Ruth". Her
// brief: "the two-line composition gives the page presence and creates a
// stronger editorial rhythm", and it is why the leading is set tighter than the
// font size - two lines that belong to each other rather than two sentences.
// With no name there is one line, and nothing is padded out to fake the second.
function greeting(name: string | null, now: Date = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part},\n${name}` : part;
}

// Day 1 is the day the period started, which is how a cycle is counted and how
// she would say it out loud. Anything older than a long cycle is not shown at
// all rather than counted up forever: "Day 96" says the log stopped, not where
// she is.
function cycleDayFrom(lastStart: string | null): number | null {
  if (!lastStart) return null;
  const start = new Date(`${lastStart}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return day >= 1 && day <= 60 ? day : null;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function OverviewPanel() {
  const flower = useHealthFlower();
  const { reload: reloadFlower } = flower;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);
  const [name, setName] = useState<string | null>(null);

  // Refetches on FOCUS, not only on mount. Overview is the root of the Body
  // stack, so it stays mounted while Food, Measurements and Activity are pushed
  // on top of it and popped back off. A mount-only fetch therefore reported
  // whatever was true when the tab was first opened: a meal logged afterwards
  // showed up on the Food screen, which is pushed fresh every visit and reloads
  // itself after its own quick-log bar, while Overview went on saying zero.
  //
  // `loading` is never set back to true here. It guards the first paint only;
  // flipping it on every return would blink the whole screen away for a refresh
  // that usually changes one number.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // THE FLOWER REFRESHES WITH THE CARDS (2026-09-17). It has its own hook,
      // which reads once on mount, and this effect never asked it to read again.
      // So the week's petals stayed as they were when the Overview first opened:
      // sessions logged afterwards appeared in the Activity card and not in the
      // flower, which sat empty until the app was restarted.
      reloadFlower();
      (async () => {
      const dayStart = startOfToday();

      // RLS scopes every read to the signed-in user.
      // syncTodaySteps joins the batch rather than following it: it reads the
      // phone's health platform, which is slower than any of these queries and
      // depends on none of them. It also WRITES the day's total on the way
      // through, so the figure survives into the roundups and the Activity
      // screen rather than existing only for as long as this screen is open.
      const [
        { data: measurements },
        { data: profileRow },
        { data: foods },
        { data: activity },
        { data: drinks },
        stepsToday,
        { data: lastPeriod },
      ] = await Promise.all([
          supabase
            .from('body_measurements')
            .select('measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
            .order('measured_at', { ascending: false })
            .limit(30),
          supabase
            .from('user_profile')
            .select(
              'height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, has_scales, protein_target_g, first_name'
            )
            .maybeSingle(),
          supabase.from('food_logs').select('kcal, protein_g').gte('happened_at', dayStart),
          supabase
            .from('activity_logs')
            // activity_type and source are not displayed here - they are read
            // only to exclude whole-day tracker totals, whose "active minutes"
            // are a day of incidental movement rather than time spent training.
            .select('duration_min, activity_type, source')
            .gte('happened_at', dayStart),
          supabase.from('hydration_logs').select('ml, happened_at').gte('happened_at', dayStart),
          syncTodaySteps(),
          // Cycle day for the Today screen (UI brief, Part 1). One row, the most
          // recent period start; nothing is written and nothing is predicted.
          supabase
            .from('cycle_events')
            .select('event_date')
            .eq('event_type', 'period_start')
            .order('event_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      const rows = (measurements ?? []) as MeasurementRow[];
      const latest = rows[0] ?? null;

      // THE LAST KNOWN VALUE FOR EACH FIELD, NOT THE LAST ROW'S (2026-09-04).
      //
      // Rows are ordered newest first, and a row can carry one reading without
      // the others: a scale that only weighs writes weight_kg and leaves body
      // fat null. Reading all three off rows[0] therefore showed dashes for
      // numbers the app already had - Ruth's 3 Sept row has a body fat and no
      // weight, so the card said "-" while 55 kg sat one row down.
      //
      // Each field now finds its own most recent non-null value. The
      // consequence, and it is a real one: the three figures can come from
      // different days, which is why the date beneath is the date of the
      // NEWEST of them and is labelled as the latest reading rather than as
      // the date of all three.
      const lastWith = <K extends keyof MeasurementRow>(key: K) =>
        rows.find((r) => r[key] != null) ?? null;
      const wRow = lastWith('weight_kg');
      const mRow = lastWith('muscle_kg');
      const fRow = lastWith('body_fat_pct');
      const bodyAsOf = [wRow, mRow, fRow]
        .filter((r): r is MeasurementRow => r != null)
        .map((r) => r.measured_at)
        .sort()
        .pop() ?? null;
      const weekAgo = latest ? findWeekAgoReading(rows, latest.measured_at) : null;
      const refGap = latest && weekAgo ? gapDays(latest.measured_at, weekAgo.measured_at) : null;

      const profile = (profileRow ?? null) as ProfileRow | null;
      const todayKcal = (foods ?? []).reduce((n, f) => n + ((f as { kcal: number | null }).kcal ?? 0), 0);
      const todayProtein = (foods ?? []).reduce(
        (n, f) => n + ((f as { protein_g: number | null }).protein_g ?? 0),
        0
      );

      // Sessions only. A daily summary's "active minutes" is a whole day of
      // walking about added up, so counting it here would tell someone they had
      // trained for 42 minutes on a day they did no training at all.
      const acts = withoutDailySummaries(
        (activity ?? []) as { duration_min: number | null; activity_type: string | null; source: string | null }[]
      );

      // The day-one line belongs to someone with nothing logged AT ALL, not to
      // someone who simply has not weighed. Today's rows cannot answer that, so
      // it takes its own look back over everything.
      let isTrueDayOne = false;
      if (!latest) {
        const [{ data: anyFood }, { data: anyActivity }] = await Promise.all([
          supabase.from('food_logs').select('id').limit(1),
          supabase.from('activity_logs').select('id').limit(1),
        ]);
        isTrueDayOne = !(anyFood && anyFood.length) && !(anyActivity && anyActivity.length);
      }
      const tdee = resolveTDEE({
        scaleBmr: latest?.bmr ?? null,
        weightKg: latest?.weight_kg ?? null,
        heightCm: profile?.height_cm ?? null,
        dateOfBirth: profile?.date_of_birth ?? null,
        biologicalSex: profile?.biological_sex ?? null,
        activityLevel: profile?.activity_level ?? null,
      });
      const calorieTarget = calculateCalorieTarget({
        tdeeKcal: tdee?.tdeeKcal ?? null,
        weightKg: latest?.weight_kg ?? null,
        fatFocus: asFocus(profile?.fat_focus_state ?? null),
        muscleFocus: asFocus(profile?.muscle_focus_state ?? null),
      });
      // Lean mass from body fat percentage, not from the scale's muscle field.
      const proteinTarget = calculateProteinTarget(
        profile?.protein_target_g ?? null,
        latest?.weight_kg ?? null,
        latest?.body_fat_pct ?? null
      );

      if (cancelled) return;
      setData({
        hasMeasurement: latest != null,
        personalLine: isTrueDayOne ? PERSONAL_LINE_DAY_ONE : pickDailyPersonalLine(),
        bodyAsOf,
        weight: {
          value: wRow?.weight_kg ?? null,
          delta: formatWeeklyDelta(weeklyDelta(wRow?.weight_kg ?? null, weekAgo?.weight_kg ?? null), refGap),
        },
        muscle: {
          value: mRow?.muscle_kg ?? null,
          delta: formatWeeklyDelta(weeklyDelta(mRow?.muscle_kg ?? null, weekAgo?.muscle_kg ?? null), refGap),
        },
        bodyFat: {
          value: fRow?.body_fat_pct ?? null,
          delta: formatWeeklyDelta(
            weeklyDelta(fRow?.body_fat_pct ?? null, weekAgo?.body_fat_pct ?? null),
            refGap
          ),
        },
        todayKcal,
        todayProtein,
        calorieTargetKcal: calorieTarget?.targetKcal ?? null,
        proteinTargetLabel: proteinTargetLabel(proteinTarget),
        activityCount: acts.length,
        activityMinutes: acts.reduce((n, a) => n + (a.duration_min ?? 0), 0),
        steps: stepsToday,
        burn: tdee
          ? {
              bmr: tdee.bmrKcal,
              tdee: tdee.tdeeKcal,
              estimated: tdee.bmrSource === 'estimated_bmr',
            }
          : null,
        hydrationMl: hydrationToday((drinks ?? []) as { ml: number; happened_at: string }[]).ml,
        cycleDay: cycleDayFrom((lastPeriod as { event_date: string } | null)?.event_date ?? null),
      });
      // The stored name, and nothing else. It is asked for at sign-up and left
      // null when somebody would rather not give one; the greeting then simply
      // has no name in it.
      setName(profile?.first_name?.trim() || null);
      setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [reloadFlower])
  );

  if (loading || !data) {
    return (
      <View style={styles.screen}>
        {/* The same header as the loaded screen, so nothing moves or changes
            size when the data arrives. */}
        <View style={styles.header}>
          <ThemedText type="display">{greeting(name)}</ThemedText>
          <View style={styles.dateRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dateText}>
              {todayLabel()}
            </ThemedText>
            <SettingsLink placement="inline" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* THE SCREEN GREETS, IT DOES NOT LABEL ITSELF (UI brief, 2026-09-17).
          "Overview" over an overview was a label on a page that explains itself;
          the brief asks for "Good morning, Ruth" with the date, in serif, and
          the tab beneath already says which screen this is. The date is written
          out in full because it is the only place in the app that says which day
          the numbers below belong to.

          The focus line sits under the greeting with no rule beside it and no
          card around it. It is a quiet observation, not a notice: the border it
          used to carry made it look like something the app wanted her to act
          on. */}
      <View style={styles.header}>
        <ThemedText type="display">{greeting(name)}</ThemedText>
        {/* Settings at the end of the date line rather than in the corner (bug
            list item 13): see settings-link.tsx for why this screen differs. */}
        <View style={styles.dateRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.dateText}>
            {todayLabel()}
            {data.cycleDay != null ? `  ·  Day ${data.cycleDay}` : ''}
          </ThemedText>
          <SettingsLink placement="inline" />
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.focusLine}>
        {data.personalLine}
      </ThemedText>

      {/* THREE SQUARES, ONE ROW. Replaces three stacked full-width cards
          (2026-09-04). The screen does not scroll, so vertical space is the
          scarcest thing on it: the old cards spent about 270px saying what
          these say in about 110, and the flower could not fit underneath them.
          Equal width, equal height, so the row reads as one object rather than
          three competing ones. */}
      <View style={styles.squareRow}>
        <Square id="body.food" title="Food" href="/log?view=food">
          {data.todayKcal === 0 && data.todayProtein === 0 ? (
            /* One line rather than two zeros stacked. Nothing was logged, and
               two separate noughts make more of that than it deserves. */
            <ThemedText type="small" themeColor="textSecondary">
              0 kcal · 0g
            </ThemedText>
          ) : (
            <>
              <SpotlightTarget id="overview.calories">
                <Stat value={String(Math.round(data.todayKcal))} unit="kcal" big />
              </SpotlightTarget>
              <SpotlightTarget id="overview.protein">
                <Stat value={String(Math.round(data.todayProtein))} unit="g protein" />
              </SpotlightTarget>
            </>
          )}
        </Square>

        {/* ALL THREE ALWAYS SHOW, dashed where the latest reading did not carry
            that value (2026-09-04, Ruth's call).

            This reverses an earlier decision, and the earlier reasoning is kept
            visible rather than deleted: muscle and body fat used to be omitted
            entirely without a bioimpedance reading, because plenty of scales
            weigh and nothing more, and a dash under "muscle" can read as a
            reading that FAILED rather than one the scale never takes. The
            counter-argument won: a card that changes shape depending on which
            fields exist is harder to scan than one with three fixed slots, and
            a dash is honest about the gap rather than hiding it.

            METRIC ONLY, FOR NOW. kg straight from the column. The unit
            preference toggle - metric, imperial, stones - is a spec build item
            (Part One, Internationalisation), and when it lands these values
            must pass through a conversion utility before display rather than
            being formatted here. One place converts; this place renders. */}
        <Square id="body.measurements" title="Body" href="/log?view=measurements">
          <SpotlightTarget id="overview.stats">
            {data.bodyAsOf == null ? (
              /* Nothing has ever been recorded. ONE dash, not three: three
                 says three separate readings failed, when in fact none has
                 been taken. */
              <ThemedText type="small" themeColor="textSecondary">
                {'—'}
              </ThemedText>
            ) : (
              <>
                <Stat value={fmt(data.weight.value, '')} unit="kg" />
                <Stat value={fmt(data.muscle.value, '')} unit="kg muscle" />
                <Stat
                  value={data.bodyFat.value != null ? `${round1(data.bodyFat.value)}` : '—'}
                  unit="% body fat"
                />
                {/* Only when the reading is not from today. A date on today's
                    own numbers is noise; a date on Tuesday's is the difference
                    between a current reading and an old one. */}
                {!isToday(data.bodyAsOf) ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.asOf}>
                    {formatLogDate(new Date(data.bodyAsOf))}
                  </ThemedText>
                ) : null}
              </>
            )}
          </SpotlightTarget>
        </Square>

        {/* STEPS ARRIVE HERE (2026-09-16). This square carried a comment saying
            steps were specified for it and deliberately absent, because nothing
            in the app read one - true since the permission was first asked for.
            lib/steps.ts reads them now.

            "NOTHING LOGGED YET" NOW HAS TO ACCOUNT FOR THEM. It was true while
            sessions were the only thing this square could know about. Beside
            four thousand steps it would be false, and falser than a blank: the
            person HAS moved, the app can see it, and it would be telling them
            otherwise. So the empty state belongs to a day with no sessions AND
            no step figure, which is also exactly the day when there is genuinely
            nothing to say.

            A null step count draws nothing at all rather than a zero. See
            lib/steps.ts: a refusal, a phone with no health platform, and a quiet
            morning are indistinguishable, and a zero would pick the one reading
            that accuses somebody of not moving. */}
        <Square id="body.activity" title="Activity" href="/log?view=activity">
          {data.activityCount === 0 && data.steps == null ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing logged yet
            </ThemedText>
          ) : (
            <>
              {data.steps != null && <Stat value={formatSteps(data.steps)} unit="steps" />}
              {data.activityCount > 0 && (
                <>
                  <Stat
                    value={String(data.activityCount)}
                    unit={data.activityCount === 1 ? 'session' : 'sessions'}
                  />
                  <Stat value={String(data.activityMinutes)} unit="min" />
                </>
              )}
            </>
          )}
        </Square>
      </View>

      {/* Hydration has no header because it is not a view to go into. It is the
          one thing on this screen you can DO, so it sits inline as an action -
          now a single strip rather than a card, for the same reason the squares
          replaced the tall sections. */}
      <SpotlightTarget id="overview.water">
        <ThemedView type="backgroundElement" style={styles.hydration}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hydrationLabel}>
            {hydrationLabel(data.hydrationMl)}
          </ThemedText>
          <HydrationQuickTap
            onLogged={(deltaMl) =>
              setData((d) => (d ? { ...d, hydrationMl: Math.max(0, d.hydrationMl + deltaMl) } : d))
            }
          />
        </ThemedView>
      </SpotlightTarget>

      {/* THIS WEEK. A peer of Today rather than a subsection of it, which is why
          the heading takes the same treatment: the spec describes the Overview
          as two sections, and two headings at one weight is what says so.
          Nothing else lives in here, and steps stay in Today's Activity card.

          The flower renders only once coverage has loaded. An unloaded week and
          an empty week are different things, and six absent petals popping into
          shape is the second one telling a lie about the first. The wrapper
          holds its height either way, so nothing below it moves when the data
          lands. */}
      <View style={styles.weekSection}>
        {/* Smaller than "Today" (2026-09-04). At title size it dominated the
            lower half of the screen; at subtitle it still reads as the second
            section without shouting over the flower it introduces. */}
        <ThemedText type="sectionTitle">This week</ThemedText>
        <View style={styles.flowerWrap}>
          {flower.coverage && (
            <HealthFlower
              coverage={flower.coverage}
              size={FLOWER_SIZE}
              // Typed-routes form: the pathname is the file, the segment is a
              // param. Building the string by hand would not typecheck.
              onSelectDimension={(d) =>
                router.push({ pathname: '/today/[dimension]', params: { dimension: d } })
              }
            />
          )}
        </View>
      </View>

      {/* Moved here from the foot of Activity, where Ruth said it was too
          hidden. Collapsed it is one row, which is all this screen can spare -
          see the no-scroll note above. The figures come from the resolveTDEE
          call this screen already makes for the calorie target, so nothing is
          computed twice. */}
      <WhatYouBurn figures={data.burn} />
    </View>
  );
}

// The heading is the link. Wrapped in its spotlight target so "where do I see my
// food" can pulse the heading that goes there, which is the first time an
// Overview element has had a real destination to point at.
// One of the three squares. The label and the chevron sit on one line at the
// top, the numbers beneath, and the whole thing is the link - a separate "see
// more" control would be a second thing to explain.
function Square({
  id,
  title,
  href,
  children,
}: {
  id: 'body.food' | 'body.measurements' | 'body.activity';
  title: string;
  href: Href;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.square}>
      <SpotlightTarget id={id} onActivate={() => router.push(href)}>
        <Pressable
          onPress={() => router.push(href)}
          accessibilityRole="link"
          accessibilityLabel={`${title}, open detail`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.headerRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {title}
            </ThemedText>
            {/* accentDeep, not accent. Full-strength terracotta on sand is
                2.43:1, under even the 3:1 a non-text control needs; the deeper
                tone is 4.76:1 and reads as the same terracotta. */}
            <Ionicons name="chevron-forward" size={16} color={theme.accentDeep} />
          </View>
        </Pressable>
      </SpotlightTarget>
      <View style={styles.squareBody}>{children}</View>
    </ThemedView>
  );
}

// A number and its unit on one line. Compact by necessity: three of these have
// to sit inside a square about a third of the screen wide.
function Stat({ value, unit, big }: { value: string; unit: string; big?: boolean }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="smallBold" style={big ? styles.statValueBig : styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statUnit} numberOfLines={1}>
        {unit}
      </ThemedText>
    </View>
  );
}

// Same calendar day in LOCAL time, which is the only comparison that means
// anything to somebody looking at their own day.
const isToday = (iso: string): boolean =>
  toLocalDateKey(new Date(iso)) === toLocalDateKey(new Date());

const fmt = (v: number | null, unit: string): string => (v == null ? '—' : `${round1(v)}${unit}`);

// Deliberately smaller than the component's 220 default. This screen does not
// scroll (see body/index.tsx), so every pixel spent here is taken from
// something already on it.
const FLOWER_SIZE = 200;

const styles = StyleSheet.create({
  weekSection: {
    gap: Spacing.three,
  },
  flowerWrap: {
    height: FLOWER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    // Tightened from Spacing.four (2026-09-04). Six children means five gaps,
    // and 24 apiece was 120px of a 591px budget on a screen that cannot
    // scroll. 16 buys back 40px, which is most of a flower.
    gap: Spacing.three,
  },
  squareRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  square: {
    flex: 1,
    // Equal width comes from flex; equal HEIGHT has to be said, or a square
    // with two numbers would sit shorter than one with three and the row would
    // read as three things instead of one.
    minHeight: 112,
    // ONE RADIUS ON THIS SCREEN (UI brief): the squares, the water strip and
    // "What you burn" all sit at CardRadius, so the row of cards reads as one
    // material rather than three shapes.
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  squareBody: {
    gap: Spacing.half,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 15,
  },
  statValueBig: {
    fontSize: 22,
  },
  asOf: {
    fontSize: 10,
    marginTop: Spacing.half,
  },
  statUnit: {
    fontSize: 11,
    // Shrinks before the number does. In a square a third of the screen wide,
    // "% body fat" is the part that can afford to be clipped; the figure is not.
    flexShrink: 1,
  },
  header: {
    // 10px higher than the page inset puts it (Ruth, 2026-09-18: "move the
    // entire heading block 8-12px higher ... so the page feels more balanced").
    // A negative margin rather than a smaller inset, so every other screen keeps
    // the same top margin as this one.
    marginTop: -10,
    // The display face now carries 10 points of padding for its descenders (see
    // themed-text.tsx), so the gap under the greeting is taken back here to keep
    // this block exactly where she approved it.
    gap: Spacing.one,
  },
  dateRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.three },
  // The date takes the room and the link keeps its own width, so a long date
  // with a cycle day wraps rather than pushing Settings off the edge.
  dateText: { flex: 1 },
  focusLine: {
    // No rule, no card. See the header block above.
    paddingRight: Spacing.four,
  },
  card: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    rowGap: Spacing.two,
  },
  figure: {
    minWidth: 0,
  },
  // A strip, not a card. One line: the reading on the left, the taps on the
  // right, everything on one baseline.
  hydration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  hydrationLabel: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
