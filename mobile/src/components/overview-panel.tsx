import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HydrationQuickTap } from '@/components/hydration-quick-tap';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveTDEE } from '@/lib/body-metrics';
import { calculateCalorieTarget, type FocusState } from '@/lib/calorie-target';
import { hydrationLabel, hydrationToday } from '@/lib/hydration';
import {
  findWeekAgoReading,
  formatWeeklyDelta,
  gapDays,
  weeklyDelta,
  type MeasurementRow,
} from '@/lib/overview-metrics';
import { PERSONAL_LINE_DAY_ONE, pickDailyPersonalLine } from '@/lib/personal-line';
import { calculateProteinTarget } from '@/lib/protein';
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
  proteinTargetG: number | null;
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
            .select('duration_min')
            .gte('happened_at', dayStart),
          supabase.from('hydration_logs').select('ml, happened_at').gte('happened_at', dayStart),
        ]);

      const rows = (measurements ?? []) as MeasurementRow[];
      const latest = rows[0] ?? null;
      const weekAgo = latest ? findWeekAgoReading(rows, latest.measured_at) : null;
      const refGap = latest && weekAgo ? gapDays(latest.measured_at, weekAgo.measured_at) : null;

      const profile = (profileRow ?? null) as ProfileRow | null;
      const todayKcal = (foods ?? []).reduce((n, f) => n + ((f as { kcal: number | null }).kcal ?? 0), 0);
      const todayProtein = (foods ?? []).reduce(
        (n, f) => n + ((f as { protein_g: number | null }).protein_g ?? 0),
        0
      );

      const acts = (activity ?? []) as { duration_min: number | null }[];

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
      const proteinTarget = calculateProteinTarget(
        profile?.protein_target_g ?? null,
        latest?.muscle_kg ?? null
      );

      if (cancelled) return;
      setData({
        hasMeasurement: latest != null,
        personalLine: isTrueDayOne ? PERSONAL_LINE_DAY_ONE : pickDailyPersonalLine(),
        weight: {
          value: latest?.weight_kg ?? null,
          delta: formatWeeklyDelta(weeklyDelta(latest?.weight_kg ?? null, weekAgo?.weight_kg ?? null), refGap),
        },
        muscle: {
          value: latest?.muscle_kg ?? null,
          delta: formatWeeklyDelta(weeklyDelta(latest?.muscle_kg ?? null, weekAgo?.muscle_kg ?? null), refGap),
        },
        bodyFat: {
          value: latest?.body_fat_pct ?? null,
          delta: formatWeeklyDelta(
            weeklyDelta(latest?.body_fat_pct ?? null, weekAgo?.body_fat_pct ?? null),
            refGap
          ),
        },
        todayKcal,
        todayProtein,
        calorieTargetKcal: calorieTarget?.targetKcal ?? null,
        proteinTargetG: proteinTarget?.grams ?? null,
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

      <Section id="body.food" title="Food" href="/body/food">
        <View style={styles.figures}>
          <SpotlightTarget id="overview.calories">
            <Figure value={String(Math.round(data.todayKcal))} unit="kcal" of={data.calorieTargetKcal} />
          </SpotlightTarget>
          <SpotlightTarget id="overview.protein">
            <Figure value={String(Math.round(data.todayProtein))} unit="g protein" of={data.proteinTargetG} />
          </SpotlightTarget>
        </View>
      </Section>

      <Section id="body.measurements" title="Body" href="/body/measurements">
        <SpotlightTarget id="overview.stats">
          <View style={styles.figures}>
            <Figure value={fmt(data.weight.value, 'kg')} note={data.hasMeasurement ? data.weight.delta : 'No readings yet'} />
            {/* Hidden rather than dashed, for the same reason as body fat below:
                a scale that only weighs never supplies it, and "—" under a
                "muscle" label reads as a reading that failed. */}
            {data.muscle.value != null && data.muscle.value > 0 ? (
              <Figure
                value={fmt(data.muscle.value, 'kg')}
                unit="muscle"
                note={data.muscle.delta}
              />
            ) : null}
            {/* Omitted entirely without a bioimpedance reading. Plenty of scales
                weigh and nothing more, and a dash where a percentage should be
                reads as a missing measurement rather than a scale that never
                takes it. */}
            {data.bodyFat.value != null && data.bodyFat.value > 0 ? (
              <Figure
                value={`${round1(data.bodyFat.value)}%`}
                unit="body fat"
                note={data.bodyFat.delta}
              />
            ) : null}
          </View>
        </SpotlightTarget>
      </Section>

      <Section id="body.activity" title="Activity" href="/body/activity">
        <ThemedText type="smallBold">
          {data.activityCount === 0
            ? 'Nothing logged yet'
            : `${data.activityCount} ${data.activityCount === 1 ? 'session' : 'sessions'}, ${data.activityMinutes} min`}
        </ThemedText>
      </Section>

      {/* Hydration has no header because it is not a view to go into. It is the
          one thing on this screen you can DO, so it sits inline as an action. */}
      <SpotlightTarget id="overview.water">
        <ThemedView type="backgroundElement" style={styles.hydration}>
          <ThemedText type="small" themeColor="textSecondary">
            {hydrationLabel(data.hydrationMl)}
          </ThemedText>
          <HydrationQuickTap
            onLogged={(deltaMl) =>
              setData((d) => (d ? { ...d, hydrationMl: Math.max(0, d.hydrationMl + deltaMl) } : d))
            }
          />
        </ThemedView>
      </SpotlightTarget>
    </View>
  );
}

// The heading is the link. Wrapped in its spotlight target so "where do I see my
// food" can pulse the heading that goes there, which is the first time an
// Overview element has had a real destination to point at.
function Section({
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

  // The card ground is the ELEVATED CREAM element surface, not brand sand.
  // theme.ts records why: charcoal on sand is comfortable at 9.99:1, but the
  // secondary text these cards carry - units, week deltas - drops to 4.08:1 on
  // it, under the AA floor. Every figure here has a secondary line beneath it,
  // so sand would put the small grey text below AA on all three cards at once.
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <SpotlightTarget id={id} onActivate={() => router.push(href)}>
        <Pressable
          onPress={() => router.push(href)}
          accessibilityRole="link"
          accessibilityLabel={`${title}, open detail`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.headerRow}>
            <ThemedText type="smallBold">{title}</ThemedText>
            {/* accentDeep, not accent. Full-strength terracotta on a sand card
                is 2.43:1, under even the 3:1 floor a non-text control needs;
                the deeper tone is 4.40:1 and reads as the same terracotta. */}
            <Ionicons name="chevron-forward" size={22} color={theme.accentDeep} />
          </View>
        </Pressable>
      </SpotlightTarget>
      {children}
    </ThemedView>
  );
}

function Figure({
  value,
  unit,
  of,
  note,
}: {
  value: string;
  unit?: string;
  of?: number | null;
  note?: string | null;
}) {
  return (
    <View style={styles.figure}>
      <ThemedText type="title">{value}</ThemedText>
      {unit ? (
        <ThemedText type="small" themeColor="textSecondary">
          {of != null ? `${unit} of ${Math.round(of)}` : unit}
        </ThemedText>
      ) : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const fmt = (v: number | null, unit: string): string => (v == null ? '—' : `${round1(v)}${unit}`);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: Spacing.four,
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
  hydration: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
