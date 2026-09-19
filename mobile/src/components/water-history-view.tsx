import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RowDelete } from '@/components/row-delete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/hydration-goal';
import { supabase } from '@/lib/supabase';
import {
  addWeeks,
  currentWeekStart,
  dayLabel,
  daysOfWeek,
  toLocalDateKey,
  weekLabel,
  weekRange,
} from '@/lib/week';

// WATER, WEEK BY WEEK (2026-09-19). Until now a drink could only be seen or
// removed on the day it was logged, from Today's card: "Still cant remove
// water", and then, once that was fixed, still nothing for any earlier day.
//
// Built as the food log's sibling rather than as something new: the same week
// stepper, the same back-to-today, and the same two-tap delete on the row. What
// it deliberately does NOT have is a target, a score, or a run of days compared
// against each other. Part Twelve rules that out for hydration, and a week laid
// out in a column is exactly where a streak would want to appear.
//
// The day totals are here to be read, not judged. A day with nothing logged
// says "nothing logged", which is not the same as a day without water - and the
// distinction matters enough to be in the words.

type Drink = { id: string; ml: number; happened_at: string };

export function WaterHistoryView() {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState<Date>(() => currentWeekStart());
  const [rows, setRows] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);

  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      const { data } = await supabase
        .from('hydration_logs')
        .select('id, ml, happened_at')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: false });
      if (cancelled) return;
      setRows((data ?? []) as Drink[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekKey, weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Drink[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const days = daysOfWeek(weekStart).filter((d) => d <= new Date());

  return (
    <>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => setWeekStart((w) => addWeeks(w, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          hitSlop={Spacing.three}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </Pressable>
        <ThemedText type="smallBold">{weekLabel(weekStart)}</ThemedText>
        <Pressable
          onPress={() => setWeekStart((w) => addWeeks(w, 1))}
          disabled={isCurrentWeek}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          hitSlop={Spacing.three}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isCurrentWeek ? theme.backgroundSelected : theme.textSecondary}
          />
        </Pressable>
      </View>

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
        <View style={styles.days}>
          {days.map((d) => {
            const key = toLocalDateKey(d);
            const drinks = byDay.get(key) ?? [];
            const total = drinks.reduce((n, r) => n + r.ml, 0);
            return (
              <ThemedView key={key} type="backgroundElement" style={styles.day}>
                <View style={styles.dayHeader}>
                  <ThemedText type="smallBold">{dayLabel(d)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {drinks.length === 0 ? 'Nothing logged' : formatVolume(total)}
                  </ThemedText>
                </View>

                {drinks.map((r) => (
                  <View key={r.id} style={styles.drinkRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                      {new Date(r.happened_at).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                    <ThemedText type="small" style={styles.volume}>
                      {formatVolume(r.ml)}
                    </ThemedText>
                    <RowDelete
                      table="hydration_logs"
                      id={r.id}
                      what={`${formatVolume(r.ml)} of water`}
                      onDeleted={() => setRows((all) => all.filter((x) => x.id !== r.id))}
                    />
                  </View>
                ))}
              </ThemedView>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backToToday: { alignSelf: 'center' },
  days: { gap: Spacing.two },
  day: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  time: { width: 52 },
  volume: { flex: 1 },
  pressed: { opacity: 0.6 },
});
