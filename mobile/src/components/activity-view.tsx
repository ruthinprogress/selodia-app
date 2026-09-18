import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LogInChatHint } from '@/components/log-in-chat-hint';
import { QuickLogBar } from '@/components/quick-log-bar';
import { Tag } from '@/components/tag';
import { ActivityIcon } from '@/components/activity-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { withoutDailySummaries } from '@/lib/daily-summary-rows';
import { supabase } from '@/lib/supabase';
import { activityIcon } from '@/lib/activity-icon';
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
  source: string | null;
  intensity: string | null;
  happened_at: string;
};

// BMR_EXPLAINER moved to components/what-you-burn.tsx on 2026-09-16, with the
// panel itself. It is not re-exported from here: a second name for the same
// three answers is how two copies start.

export function ActivityView() {
  const theme = useTheme();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  // See food-today-view: the quick-log bar bumps this so the list re-reads.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
      // RLS scopes every read to the signed-in user.
      // ONE READ NOW. The profile and body_measurements reads that sat here fed
      // the BMR/TDEE panel, and that panel moved to the Overview on 2026-09-16.
      // They moved with it rather than being fetched twice on two screens - the
      // Overview already makes the same resolveTDEE call for its calorie target.
      const { data: activity } = await supabase
        .from('activity_logs')
        .select('id, activity_type, duration_min, kcal_burned, intensity, happened_at, source')
        .gte('happened_at', since)
        .order('happened_at', { ascending: false });
      if (cancelled) return;

      // Sessions only. A whole-day tracker total is not something the person
      // did, and listing one here beside real workouts is what made a day's
      // incidental walking read as a 1063 kcal session.
      setRows(withoutDailySummaries((activity ?? []) as ActivityRow[]));
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

      {/* The way back through the weeks, in both shapes Ruth asked for on the
          Food tab (2026-09-16): an arrow beside the heading, where a thumb
          goes, and the explicit link below the list. Both unconditional - the
          way back must be there whether or not this fortnight has anything in
          it - and both going to the same screen. One of the two comes out once
          she knows which she uses. */}
      <View style={styles.headingRow}>
        <Pressable
          onPress={() => router.push('/log/activity-history')}
          accessibilityRole="button"
          accessibilityLabel="Earlier weeks"
          hitSlop={Spacing.three}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </Pressable>
        <ThemedText type="smallBold">Recent activity</ThemedText>
      </View>

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
              {/* The movement, drawn (UI brief, Part 2). Hidden from screen
                  readers: the activity's own name is right beside it. */}
              <ActivityIcon kind={activityIcon(r.activity_type)} size={20} />
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

      <Pressable
        onPress={() => router.push('/log/activity-history')}
        accessibilityRole="button"
        accessibilityLabel="Earlier weeks"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="accentDeep" style={styles.heading}>
          Earlier weeks
        </ThemedText>
      </Pressable>

      {/* "What you burn" MOVED TO THE OVERVIEW on 2026-09-16: Ruth said it was
          too hidden down here, and it now sits minimised on the screen she
          actually lands on. It is not duplicated here on purpose - two copies
          of the same three answers is how they drift apart, and the one that
          drifts is always the one nobody is looking at. See
          components/what-you-burn.tsx. */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  heading: { paddingHorizontal: Spacing.one, marginTop: Spacing.four },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    marginTop: Spacing.four,
  },
  pressed: { opacity: 0.6 },
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
