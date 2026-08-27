import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveTDEE } from '@/lib/body-metrics';
import { calculateCalorieTarget, type FocusState } from '@/lib/calorie-target';
import {
  findWeekAgoReading,
  formatWeeklyDelta,
  gapDays,
  weeklyDelta,
  type MeasurementRow,
} from '@/lib/overview-metrics';
import { PERSONAL_LINE_DAY_ONE, pickDailyPersonalLine } from '@/lib/personal-line';
import { DAILY_TARGET_ML, hydrationLabel, hydrationToday } from '@/lib/hydration';
import { calculateProteinTarget } from '@/lib/protein';
import { dayLevelProteinNudge, type ProteinSource } from '@/lib/protein-quality';
import { supabase } from '@/lib/supabase';

// The Overview segment of the Body tab — the default landing (UNFLUMP_SPEC.md,
// The Overview Segment). A lightweight cross-facet glance: a rotating personal
// line, a body summary (weight / body fat / muscle with vs-last-week deltas),
// and a food-intake card with calorie + protein target-vs-current bars plus the
// day-level protein-quality nudge (item 12). The
// calorie target composes the two already-built pure functions —
// resolveTDEE(...) -> calculateCalorieTarget(...). Hydration (item 31) is
// deliberately deferred until its backend exists. Colours use the current
// neutral theme; the brand palette (terracotta/forest/sage) is a separate
// Part Fifteen visual pass.

type ProfileRow = {
  height_cm: number | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  activity_level: string | null;
  fat_focus_state: string | null;
  muscle_focus_state: string | null;
  has_scales: boolean | null;
};

type Metric = { value: number | null; delta: string | null };
type OverviewData = {
  hasMeasurement: boolean;
  personalLine: string;
  weight: Metric;
  bodyFat: Metric;
  muscle: Metric;
  todayKcal: number;
  todayProtein: number;
  calorieTargetKcal: number | null;
  proteinTargetG: number | null;
  proteinQualityNote: string | null;
  hydrationMl: number;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;
const asFocus = (s: string | null): FocusState =>
  s === 'reduce' || s === 'increase' ? s : 'maintain';

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function OverviewPanel() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    (async () => {
      // RLS scopes every read to the signed-in user.
      const { data: measurements } = await supabase
        .from('body_measurements')
        .select('measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
        .order('measured_at', { ascending: false });
      const { data: profile } = await supabase
        .from('user_profile')
        .select('height_cm, date_of_birth, biological_sex, activity_level, fat_focus_state, muscle_focus_state, has_scales')
        .maybeSingle();

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [{ data: food }, { data: water }] = await Promise.all([
        supabase
          .from('food_logs')
          .select('kcal, protein_g, protein_source')
          .gte('happened_at', startOfDay.toISOString()),
        // Today only. Hydration is a same-day reflection by design (Part
        // Twelve), so nothing here is capable of producing a streak.
        supabase
          .from('hydration_logs')
          .select('ml, happened_at')
          .gte('happened_at', startOfDay.toISOString()),
      ]);

      const rows = (measurements ?? []) as MeasurementRow[];
      const latest = rows[0] ?? null;
      const p = (profile ?? {}) as ProfileRow;
      const foodRows = (food ?? []) as {
        kcal: number | null;
        protein_g: number | null;
        protein_source: string | null;
      }[];
      const hydrationMl = hydrationToday(
        (water ?? []) as { ml: number; happened_at: string }[]
      ).ml;
      const todayKcal = foodRows.reduce((s, f) => s + (f.kcal ?? 0), 0);
      const todayProtein = foodRows.reduce((s, f) => s + (f.protein_g ?? 0), 0);
      // Day-level protein-quality nudge (build item 12): when more than half of
      // today's logged protein comes from incomplete sources, the complementary-
      // pairing note rides this same card, next to the protein bar it qualifies.
      // protein_source is classified at log time (Part Two, principle 13).
      const proteinBySource = foodRows.map((f) => ({
        source: (f.protein_source as ProteinSource | null) ?? null,
        grams: f.protein_g ?? 0,
      }));

      if (!latest) {
        // Empty state — no measurement to summarise. The personal line is the
        // true day-one exception ONLY when there are zero logged entries ever
        // (no food, no activity either); otherwise it rotates like any day.
        const [{ data: anyFood }, { data: anyActivity }] = await Promise.all([
          supabase.from('food_logs').select('id').limit(1),
          supabase.from('activity_logs').select('id').limit(1),
        ]);
        const isTrueDayOne = !(anyFood && anyFood.length) && !(anyActivity && anyActivity.length);
        setData({
          hasMeasurement: false,
          personalLine: isTrueDayOne ? PERSONAL_LINE_DAY_ONE : pickDailyPersonalLine(),
          weight: { value: null, delta: null },
          bodyFat: { value: null, delta: null },
          muscle: { value: null, delta: null },
          todayKcal,
          todayProtein,
          calorieTargetKcal: null,
          proteinTargetG: null,
          proteinQualityNote: dayLevelProteinNudge(proteinBySource, null)?.message ?? null,
          hydrationMl,
        });
        setLoading(false);
        return;
      }

      const weekAgo = findWeekAgoReading(rows, latest.measured_at);
      // How far back that reference actually sits, so the label can say so.
      // With real logging it is rarely a week (Ruth's live screen compared
      // against a reading 2.6 days old and called it "vs last wk").
      const refGap = weekAgo ? gapDays(latest.measured_at, weekAgo.measured_at) : null;
      const tdee = resolveTDEE({
        scaleBmr: latest.bmr,
        weightKg: latest.weight_kg,
        heightCm: p.height_cm,
        dateOfBirth: p.date_of_birth,
        biologicalSex: p.biological_sex,
        activityLevel: p.activity_level,
      });
      const calorieTarget = tdee
        ? calculateCalorieTarget({
            tdeeKcal: tdee.tdeeKcal,
            weightKg: latest.weight_kg,
            fatFocus: asFocus(p.fat_focus_state),
            muscleFocus: asFocus(p.muscle_focus_state),
          })
        : null;
      const proteinTarget = calculateProteinTarget(latest.muscle_kg, latest.weight_kg, p.has_scales ?? false);

      setData({
        hasMeasurement: true,
        personalLine: pickDailyPersonalLine(),
        weight: {
          value: latest.weight_kg,
          delta: formatWeeklyDelta(weeklyDelta(latest.weight_kg, weekAgo?.weight_kg ?? null), refGap),
        },
        bodyFat: {
          value: latest.body_fat_pct,
          delta: formatWeeklyDelta(weeklyDelta(latest.body_fat_pct, weekAgo?.body_fat_pct ?? null), refGap),
        },
        muscle: {
          value: latest.muscle_kg,
          delta: formatWeeklyDelta(weeklyDelta(latest.muscle_kg, weekAgo?.muscle_kg ?? null), refGap),
        },
        todayKcal,
        todayProtein,
        calorieTargetKcal: calorieTarget?.targetKcal ?? null,
        proteinTargetG: proteinTarget?.grams ?? null,
        proteinQualityNote:
          dayLevelProteinNudge(proteinBySource, proteinTarget?.grams ?? null)?.message ?? null,
        hydrationMl,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <ThemedText type="title">Today</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {todayLabel()}
      </ThemedText>

      {loading || !data ? (
        <ThemedText type="small" themeColor="textSecondary">
          …
        </ThemedText>
      ) : (
        <>
          <ThemedView style={[styles.personalLine, { borderLeftColor: theme.textSecondary }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.personalLineText}>
              {data.personalLine}
            </ThemedText>
          </ThemedView>

          <View style={styles.row3}>
            <BodyCard label="Weight" value={fmt(data.weight.value, 'kg')} delta={cardDelta(data)} deltaText={data.weight.delta} />
            <BodyCard label="Body fat" value={fmt(data.bodyFat.value, '%')} delta={cardDelta(data)} deltaText={data.bodyFat.delta} />
            <BodyCard label="Muscle" value={fmt(data.muscle.value, 'kg')} delta={cardDelta(data)} deltaText={data.muscle.delta} />
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Food intake</ThemedText>
            <Bar label="Calories" current={data.todayKcal} target={data.calorieTargetKcal} unit="kcal" />
            <Bar label="Protein" current={data.todayProtein} target={data.proteinTargetG} unit="g" />
            {/* Same visual family as the two bars above it (Part Twelve), and
                deliberately last: water is a gentle reflection, not a headline.
                Its label reads "1.2L of about 2L" - no percentage and no "to
                go", both of which turn a reflection into a target to hit. */}
            <Bar
              label="Water"
              current={data.hydrationMl}
              target={DAILY_TARGET_ML}
              unit="ml"
              valueLabel={hydrationLabel(data.hydrationMl)}
            />
            {data.proteinQualityNote && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.proteinNote}>
                {data.proteinQualityNote}
              </ThemedText>
            )}
          </ThemedView>
        </>
      )}
    </>
  );
}

const fmt = (v: number | null, unit: string): string => (v == null ? '—' : `${round1(v)}${unit}`);
// When there's no measurement at all, every card reads "No data yet".
const cardDelta = (d: OverviewData): boolean => d.hasMeasurement;

function BodyCard({ label, value, delta, deltaText }: { label: string; value: string; delta: boolean; deltaText: string | null }) {
  return (
    <ThemedView type="backgroundElement" style={styles.bodyCard}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.bodyCardLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.bodyCardDelta}>
        {delta ? (deltaText ?? ' ') : 'No data yet'}
      </ThemedText>
    </ThemedView>
  );
}

function Bar({
  label,
  current,
  target,
  unit,
  // Lets a bar state its own value in its own words. Calories and protein read
  // naturally as "1400 / 1670 kcal"; water does not, because a target one is
  // invited to exceed should not be written like one to hit.
  valueLabel,
}: {
  label: string;
  current: number;
  target: number | null;
  unit: string;
  valueLabel?: string;
}) {
  const theme = useTheme();
  const cur = Math.round(current);
  const pct = target != null && target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {valueLabel ?? (target != null ? `${cur} / ${Math.round(target)} ${unit}` : `${cur} ${unit} logged`)}
        </ThemedText>
      </View>
      <View style={[styles.barTrack, { backgroundColor: theme.background }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.textSecondary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  personalLine: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: Spacing.one,
  },
  personalLineText: {
    fontStyle: 'italic',
  },
  row3: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bodyCard: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  bodyCardLabel: {
    fontSize: 11,
  },
  bodyCardDelta: {
    fontSize: 10,
  },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  proteinNote: {
    fontSize: 11,
    lineHeight: 16,
  },
  barRow: {
    gap: Spacing.one,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barTrack: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});
