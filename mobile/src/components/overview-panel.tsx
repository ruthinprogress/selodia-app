import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HydrationQuickTap } from '@/components/hydration-quick-tap';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
import { supabase } from '@/lib/supabase';

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
  hydrationMl: number;
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
};

const round1 = (n: number): number => Math.round(n * 10) / 10;
const asFocus = (s: string | null): FocusState =>
  s === 'reduce' || s === 'increase' ? s : 'maintain';

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function OverviewPanel() {
  const theme = useTheme();
  const flower = useHealthFlower();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);

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
      (async () => {
      const dayStart = startOfToday();

      // RLS scopes every read to the signed-in user.
      const [{ data: measurements }, { data: profileRow }, { data: foods }, { data: activity }, { data: drinks }] =
        await Promise.all([
          supabase
            .from('body_measurements')
            .select('measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
            .order('measured_at', { ascending: false })
            .limit(30),
          supabase
            .from('user_profile')
            .select(
              'height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, has_scales, protein_target_g'
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
        hydrationMl: hydrationToday((drinks ?? []) as { ml: number; happened_at: string }[]).ml,
      });
      setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading || !data) {
    return (
      <View style={styles.screen}>
        <ThemedText type="title">Today</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {todayLabel()}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View>
        <ThemedText type="title">Today</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {todayLabel()}
        </ThemedText>
      </View>

      <ThemedView style={[styles.personalLine, { borderLeftColor: theme.textSecondary }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {data.personalLine}
        </ThemedText>
      </ThemedView>

      {/* THREE SQUARES, ONE ROW. Replaces three stacked full-width cards
          (2026-09-04). The screen does not scroll, so vertical space is the
          scarcest thing on it: the old cards spent about 270px saying what
          these say in about 110, and the flower could not fit underneath them.
          Equal width, equal height, so the row reads as one object rather than
          three competing ones. */}
      <View style={styles.squareRow}>
        <Square id="body.food" title="Food" href="/body/food">
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
        <Square id="body.measurements" title="Body" href="/body/measurements">
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

        {/* Steps are specified for this square and are NOT here, because
            nothing in the app reads them yet: step-permission.ts asks for the
            permission and no code ever calls getStepCount or readRecords. A
            zero would be a claim that someone had not moved. */}
        <Square id="body.activity" title="Activity" href="/body/activity">
          {data.activityCount === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing logged yet
            </ThemedText>
          ) : (
            <>
              <Stat
                value={String(data.activityCount)}
                unit={data.activityCount === 1 ? 'session' : 'sessions'}
              />
              <Stat value={String(data.activityMinutes)} unit="min" />
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
        <ThemedText type="subtitle">This week</ThemedText>
        <View style={styles.flowerWrap}>
          {flower.coverage && (
            <HealthFlower
              coverage={flower.coverage}
              size={FLOWER_SIZE}
              // Typed-routes form: the pathname is the file, the segment is a
              // param. Building the string by hand would not typecheck.
              onSelectDimension={(d) =>
                router.push({ pathname: '/body/[dimension]', params: { dimension: d } })
              }
            />
          )}
        </View>
      </View>
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
    minHeight: 104,
    borderRadius: Spacing.three,
    padding: Spacing.two,
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
  personalLine: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
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
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
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
