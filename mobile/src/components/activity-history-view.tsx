import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityDetailCard } from '@/components/activity-detail-card';
import { RowDelete } from '@/components/row-delete';
import { Tag } from '@/components/tag';
import { ActivityIcon } from '@/components/activity-icon';
import { activityIcon } from '@/lib/activity-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { withoutDailySummaries } from '@/lib/daily-summary-rows';
import { supabase } from '@/lib/supabase';
import {
  addWeeks,
  currentWeekStart,
  dayLabel,
  daysOfWeek,
  toLocalDateKey,
  weekLabel,
  weekRange,
  weekStartFor,
} from '@/lib/week';

// The activity log, week by week (Ruth, 2026-09-16: "let's roll out the weekly
// back scrolling to Activity tab too").
//
// The food history's shape, ported: addressed by a week and never by "today",
// the stepper moves that one value, Next stops at the current week, and it opens
// on the most recent week that actually holds sessions so it never greets
// somebody with seven empty days.
//
// ONE DIFFERENCE FROM FOOD, because activity is a different thing.
//   - Daily tracker totals are filtered out, the same rule the Activity segment
//     already applies: a whole-day step total is not a session somebody did, and
//     listing one beside real workouts is what made incidental walking read as a
//     1063 kcal session.

type ActivityRow = {
  id: string;
  activity_type: string | null;
  duration_min: number | null;
  kcal_burned: number | null;
  intensity: string | null;
  source: string | null;
  happened_at: string;
  notes: string | null;
};

export function ActivityHistoryView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState<Date>(() => initialWeekStart ?? currentWeekStart());
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Which session is open in the detail card, and a key the card bumps when it
  // deletes one so this week re-reads (2026-09-18). The note above used to say
  // this log had no eye because there was nothing to open; ActivityDetailCard
  // now exists, so it does.
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());

  // Opens where the sessions are. Only when no week was asked for: a link into a
  // particular week is an instruction, not a suggestion.
  useEffect(() => {
    if (initialWeekStart) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('happened_at, source')
        .order('happened_at', { ascending: false })
        .limit(20);
      const sessions = withoutDailySummaries((data ?? []) as ActivityRow[]);
      const latest = sessions[0]?.happened_at;
      if (cancelled || typeof latest !== 'string') return;
      const week = weekStartFor(new Date(latest));
      if (toLocalDateKey(week) !== toLocalDateKey(currentWeekStart())) setWeekStart(week);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWeekStart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      // RLS scopes the read to the signed-in user.
      const { data } = await supabase
        .from('activity_logs')
        .select('id, activity_type, duration_min, kcal_burned, intensity, source, happened_at, notes')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: true });
      if (cancelled) return;
      setRows(withoutDailySummaries((data ?? []) as ActivityRow[]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const weekMinutes = rows.reduce((sum, r) => sum + (r.duration_min ?? 0), 0);

  return (
    <>
      <View style={styles.stepper}>
        <StepButton
          label="Previous week"
          icon="chevron-back"
          onPress={() => setWeekStart((w) => addWeeks(w, -1))}
        />
        <ThemedText type="smallBold">{weekLabel(weekStart)}</ThemedText>
        <StepButton
          label="Next week"
          icon="chevron-forward"
          disabled={isCurrentWeek}
          onPress={() => setWeekStart((w) => addWeeks(w, 1))}
        />
      </View>

      {/* The way home, same as the food log: stepping back six weeks otherwise
          costs six presses to return, and the arrows give no sense of how far
          from this week you have gone. Only when away from it. */}
      {!isCurrentWeek && (
        <Pressable
          onPress={() => setWeekStart(currentWeekStart())}
          accessibilityRole="button"
          accessibilityLabel="Back to today"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.backToToday, pressed && styles.pressed]}
        >
          <ThemedText type="small" themeColor="accentDeep">
            Back to today
          </ThemedText>
        </Pressable>
      )}

      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          …
        </ThemedText>
      ) : (
        daysOfWeek(weekStart).map((day) => {
          const entries = byDay.get(toLocalDateKey(day)) ?? [];
          const minutes = entries.reduce((sum, r) => sum + (r.duration_min ?? 0), 0);
          return (
            <ThemedView key={toLocalDateKey(day)} type="backgroundElement" style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <ThemedText type="smallBold">{dayLabel(day)}</ThemedText>
                {minutes > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.round(minutes)} min
                  </ThemedText>
                )}
              </View>

              {entries.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nothing logged.
                </ThemedText>
              ) : (
                entries.map((r) => (
                  <View key={r.id} style={styles.row}>
                    {/* Same mark as today's list, so a session looks the same
                        wherever it is met. */}
                    <ActivityIcon kind={activityIcon(r.activity_type)} size={18} />
                    <View style={styles.rowMain}>
                      <ThemedText type="small" selectable>
                        {r.activity_type ?? 'Movement'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {r.duration_min != null ? `${Math.round(r.duration_min)} min` : 'no duration'}
                        {r.kcal_burned != null ? ` · ${Math.round(r.kcal_burned)} kcal` : ''}
                      </ThemedText>
                    </View>
                    {/* Classified at log time (item 33), so an older row with no
                        intensity renders no tag rather than a guess. */}
                    <Tag context="intensity" value={r.intensity} />
                    <Pressable
                      onPress={() => setOpenId(r.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Look closer at ${r.activity_type ?? 'this session'}`}
                      hitSlop={Spacing.two}
                      style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
                    >
                      <Ionicons name="eye-outline" size={16} color={theme.textSecondary} />
                    </Pressable>
                    <RowDelete
                      table="activity_logs"
                      id={r.id}
                      what={r.activity_type ?? 'this session'}
                      onDeleted={() => setReloadKey((k) => k + 1)}
                    />
                  </View>
                ))
              )}
            </ThemedView>
          );
        })
      )}

      {weekMinutes > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(weekMinutes)} minutes this week
        </ThemedText>
      )}

      <ActivityDetailCard
        activity={rows.find((r) => r.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onDeleted={() => {
          setOpenId(null);
          setReloadKey((k) => k + 1);
        }}
      />
    </>
  );
}

function StepButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: 'chevron-back' | 'chevron-forward';
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={Spacing.three}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={disabled ? theme.backgroundSelected : theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  backToToday: {
    alignSelf: 'center',
  },
  dayCard: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  eye: { width: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
