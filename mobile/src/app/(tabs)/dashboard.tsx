import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getBasalMetabolismTrend } from '@/lib/basal-metabolism';
import { interpretLatestReading } from '@/lib/measurement-interpretation';
import { calculateProteinTarget, type ProteinTarget } from '@/lib/protein';
import { supabase } from '@/lib/supabase';

type Measurement = {
  measured_at: string;
  bmr: number | null;
  muscle_kg: number | null;
  weight_kg: number | null;
};

// Surfaces the already-built protein and basal-metabolism calculations as
// understated stats (UNFLUMP_SPEC.md, Part Sixteen, Phase 1 steps 2-3). The
// full visual trend chart is deferred - it needs a charting library, which is a
// separate native addition (Part Two, principle 10: cosmetic can wait).
export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [protein, setProtein] = useState<ProteinTarget | null>(null);
  const [proteinNote, setProteinNote] = useState<string | null>(null);
  const [bmrLine, setBmrLine] = useState<string | null>(null);
  const [readingNote, setReadingNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // RLS scopes reads to the signed-in user - no explicit user_id filter.
      const { data: measurements } = await supabase
        .from('body_measurements')
        .select('measured_at, bmr, muscle_kg, weight_kg')
        .order('measured_at', { ascending: false });
      const { data: profile } = await supabase.from('user_profile').select('has_scales').maybeSingle();

      const rows = (measurements ?? []) as Measurement[];
      const latest = rows[0] ?? null;
      const hasScales = profile?.has_scales ?? false;

      const p = calculateProteinTarget(latest?.muscle_kg, latest?.weight_kg, hasScales);
      setProtein(p);
      if (p) {
        setProteinNote(
          p.source === 'muscle_mass'
            ? 'Based on your muscle mass.'
            : p.expectToImprove
              ? 'Based on bodyweight for now — this sharpens once you have scale readings.'
              : 'Based on bodyweight.'
        );
      }

      // getBasalMetabolismTrend re-sorts ascending internally; latest is last.
      const trend = getBasalMetabolismTrend(rows);
      if (trend.length > 0) {
        const last = trend[trend.length - 1];
        const muscle = last.muscleKg != null ? ` (muscle ${last.muscleKg} kg)` : '';
        if (trend.length >= 2) {
          const delta = Math.round(last.bmr - trend[0].bmr);
          const dir = delta > 0 ? `up ${delta}` : delta < 0 ? `down ${Math.abs(delta)}` : 'level';
          setBmrLine(`${Math.round(last.bmr)} kcal${muscle} · ${dir} since ${formatDate(trend[0].measuredAt)}`);
        } else {
          setBmrLine(`${Math.round(last.bmr)} kcal${muscle}`);
        }
      }

      // Interpretation of the latest reading (Part Nine layer): the trend engine
      // separates a real multi-reading trend from single-day noise, with cycle
      // phase as the first noise flagger. RLS scopes the cycle read.
      if (latest) {
        const { data: lastPeriod } = await supabase
          .from('cycle_events')
          .select('event_date')
          .eq('event_type', 'period_start')
          .order('event_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        // Activity in the day up to the reading, for the post-workout pump flag
        // (the util applies the 4h window). RLS scopes it to this user.
        const windowStart = new Date(
          new Date(latest.measured_at).getTime() - 24 * 60 * 60 * 1000
        ).toISOString();
        const { data: recentActs } = await supabase
          .from('activity_logs')
          .select('happened_at')
          .gte('happened_at', windowStart)
          .lte('happened_at', latest.measured_at);
        const interp = interpretLatestReading({
          latest: { weightKg: latest.weight_kg, measuredAt: latest.measured_at },
          priorWeights: rows.slice(1).map((r) => r.weight_kg).filter((w): w is number => w != null),
          lastPeriodStart: lastPeriod?.event_date ?? null,
          recentActivityTimes: (recentActs ?? [])
            .map((a) => a.happened_at as string | null)
            .filter((t): t is string => t != null),
          priorMeasuredAts: rows.slice(1).map((r) => r.measured_at),
        });
        setReadingNote(interp?.message ?? null);
      }

      setLoading(false);
    })();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          <ThemedText type="title">Dashboard</ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Daily protein target</ThemedText>
            {loading ? (
              <ThemedText type="small" themeColor="textSecondary">
                …
              </ThemedText>
            ) : protein ? (
              <>
                <ThemedText type="title">{protein.grams}g</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {proteinNote}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Log a body measurement to see your protein target.
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Basal metabolism</ThemedText>
            {loading ? (
              <ThemedText type="small" themeColor="textSecondary">
                …
              </ThemedText>
            ) : bmrLine ? (
              <ThemedText type="small">{bmrLine}</ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No basal metabolism readings yet.
              </ThemedText>
            )}
          </ThemedView>

          {readingNote && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Your latest reading</ThemedText>
              <ThemedText type="small">{readingNote}</ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
