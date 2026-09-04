import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogInChatHint } from '@/components/log-in-chat-hint';
import { QuickLogBar } from '@/components/quick-log-bar';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveTDEE } from '@/lib/body-metrics';
import { supabase } from '@/lib/supabase';
import { formatLogDate } from '@/lib/week';

// The Activity segment (Part Five / Part Eight).
//
// Two jobs, in this order: the recent activity itself, then the BMR/TDEE
// explainer, which lives HERE rather than on the Overview (relocated
// 2026-08-15). That relocation left basal-metabolism.ts and the resolveTDEE
// chain with no UI consumer at all for ten days; this is the screen they were
// waiting for.
//
// DELIBERATELY NO CHART. Part Eight abandons the BMR/muscle trend chart rather
// than deferring it, and gives the reason: the muscle-mass mechanism is roughly
// 10-13 kcal/day per kilogram, which over any encouraging timescale reads as a
// near-flat line - and a flat line would directly undercut the app's own honest
// prose about that very fact. TDEE was ruled out as a chart subject on the same
// grounds. So this is prose and a number, on purpose, not for want of a
// charting library.

const LOOKBACK_DAYS = 14;

type ActivityRow = {
  id: string;
  activity_type: string | null;
  duration_min: number | null;
  kcal_burned: number | null;
  intensity: string | null;
  happened_at: string;
};

export const BMR_EXPLAINER = [
  {
    q: "What's basal metabolic rate (BMR)?",
    a: 'What your body burns just staying alive at complete rest: breathing, heartbeat, organ function, cell repair. The energy cost of simply existing, before you’ve moved a muscle.',
  },
  {
    q: "What's total daily energy expenditure (TDEE)?",
    a: 'Your BMR plus everything else: walking, training, digesting food, even fidgeting. TDEE is always higher than BMR; it’s BMR with your whole day layered on top.',
  },
  {
    q: 'Does building muscle raise your BMR?',
    a: 'Yes, but modestly. Research puts it at roughly 10-13 kcal a day for every kilogram of muscle gained.',
  },
];

export function ActivityView() {
  const theme = useTheme();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [tdee, setTdee] = useState<{ bmr: number | null; tdee: number | null; estimated: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  // See food-today-view: the quick-log bar bumps this so the list re-reads.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
      // RLS scopes every read to the signed-in user.
      const [{ data: activity }, { data: profile }, { data: measurements }] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id, activity_type, duration_min, kcal_burned, intensity, happened_at')
          .gte('happened_at', since)
          .order('happened_at', { ascending: false }),
        supabase
          .from('user_profile')
          .select('date_of_birth, biological_sex, activity_level, height_cm')
          .maybeSingle(),
        supabase
          .from('body_measurements')
          .select('weight_kg, bmr')
          .order('measured_at', { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;

      setRows((activity ?? []) as ActivityRow[]);

      const p = (profile ?? {}) as {
        date_of_birth?: string | null;
        biological_sex?: string | null;
        activity_level?: string | null;
        height_cm?: number | null;
      };
      const latest = ((measurements ?? []) as { weight_kg: number | null; bmr: number | null }[])[0] ?? null;
      const resolved = resolveTDEE({
        scaleBmr: latest?.bmr ?? null,
        weightKg: latest?.weight_kg ?? null,
        heightCm: p.height_cm ?? null,
        dateOfBirth: p.date_of_birth ?? null,
        biologicalSex: p.biological_sex ?? null,
        activityLevel: p.activity_level ?? null,
      });
      setTdee(
        resolved
          ? {
              bmr: resolved.bmrKcal,
              tdee: resolved.tdeeKcal,
              estimated: resolved.bmrSource === 'estimated_bmr',
            }
          : null
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading) return null;

  return (
    <ThemedView style={styles.wrap}>
      {/* Above the list, because it is the thing you came here to do. */}
      <QuickLogBar kind="activity" onLogged={() => setReloadKey((k) => k + 1)} />

      <LogInChatHint tab="activity" />

      <ThemedText type="smallBold" style={styles.heading}>
        Recent activity
      </ThemedText>

      {rows.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.empty} accessibilityRole="summary">
          <ThemedText type="smallBold" style={styles.centred}>
            Nothing logged yet
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>
            Add what you did above (a walk, a session, a class) and it&apos;ll show up here.
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedView
          type="backgroundElement"
          style={[styles.card, { borderColor: theme.backgroundSelected }]}
        >
          {rows.map((r, i) => (
            <View
              key={r.id}
              style={[
                styles.row,
                i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
                { borderBottomColor: theme.backgroundSelected },
              ]}
            >
              <View style={styles.rowMain}>
                <ThemedText type="small" selectable>
                  {r.activity_type ?? 'Activity'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatLogDate(new Date(r.happened_at))}
                  {r.duration_min != null ? ` · ${Math.round(r.duration_min)} min` : ''}
                  {r.kcal_burned != null ? ` · ${Math.round(r.kcal_burned)} kcal` : ''}
                </ThemedText>
              </View>
              {/* Classified at log time (item 33), so an older row with no
                  intensity simply renders no tag rather than a guess. */}
              <Tag context="intensity" value={r.intensity} />
            </View>
          ))}
        </ThemedView>
      )}

      <ThemedText type="smallBold" style={styles.heading}>
        What you burn
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {tdee?.bmr != null || tdee?.tdee != null ? (
          <View style={styles.numbers}>
            <Stat label="BMR" value={tdee.bmr} />
            <Stat label="TDEE" value={tdee.tdee} />
          </View>
        ) : null}

        {/* Said plainly rather than hidden: an estimate and a scale reading are
            not the same thing, and the person should know which she is looking
            at before she reasons from it. */}
        {tdee?.estimated ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Estimated from your height, age and weight. A scale that reads BMR directly gives a
            closer figure.
          </ThemedText>
        ) : null}

        {BMR_EXPLAINER.map((item) => (
          <View key={item.q} style={styles.explainerItem}>
            <ThemedText type="smallBold">{item.q}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.a}
            </ThemedText>
          </View>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value != null ? `${Math.round(value)} kcal` : '—'}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  heading: { paddingHorizontal: Spacing.one, marginTop: Spacing.four },
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    overflow: 'hidden',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  numbers: { flexDirection: 'row', gap: Spacing.six },
  stat: { gap: Spacing.half },
  note: { fontStyle: 'italic' },
  explainerItem: { gap: Spacing.half },
  empty: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  centred: { textAlign: 'center' },
});
