import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FoodBreakdownCard } from '@/components/food-breakdown-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadEntriesWithDiscussion } from '@/lib/discuss-state';
import { entryLabel, sumDay, weeklyAverage, type FoodLogSummary } from '@/lib/food-today';
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

// The food log, week by week (Ruth, 2026-09-16).
//
// WHY IT EXISTS. She caught up seven days of meals and then could not find any
// of them: the Food segment shows TODAY, with a one-line weekly average, and
// nothing anywhere stepped back to the week those entries landed in. Her words:
// "all logs should be navigable", and "i should be able to look back at previous
// weeks and even see entries in more details and select them to discuss further
// in chat". Two of those three are here; the third is the discuss-card's
// interactive half (build item 30), which has never been built on any card.
//
// ADDRESSED BY A WEEK, never by "today", the same rule week.ts was written to.
// The stepper moves that one value and everything re-reads from it, so a future
// deep-link into a particular week needs no new path.
//
// NEXT STOPS AT THIS WEEK. There is nothing to show in a future week, and a
// stepper that walks into empty weeks forever invites the question of whether
// something failed to load.

export function FoodHistoryView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState<Date>(() => initialWeekStart ?? currentWeekStart());

  // IT OPENS ON THE LAST WEEK THAT HAS ANYTHING IN IT (2026-09-16, within an
  // hour of shipping). Ruth opened this screen and reported "there is nothing at
  // all in Food log" - correctly, because it opened on THIS week, and the seven
  // days she had just caught up were in the week before. Seven rows of "Nothing
  // logged" is indistinguishable from a screen that failed to load, and a
  // history view that opens on an empty week asks the person to guess that the
  // arrows are worth pressing.
  //
  // Only when no week was asked for: a link into a particular week is an
  // instruction, and must not be overridden by where the data happens to be.
  useEffect(() => {
    if (initialWeekStart) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('food_logs')
        .select('happened_at')
        .order('happened_at', { ascending: false })
        .limit(1);
      const latest = data?.[0]?.happened_at;
      if (cancelled || typeof latest !== 'string') return;
      const week = weekStartFor(new Date(latest));
      // Never forward: if the newest entry is in this week, this week is right.
      if (toLocalDateKey(week) !== toLocalDateKey(currentWeekStart())) setWeekStart(week);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWeekStart]);
  const [rows, setRows] = useState<FoodLogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [discussed, setDiscussed] = useState<Set<string>>(new Set());

  // Stable primitive dep: a fresh Date each render would refire the effect.
  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const set = await loadEntriesWithDiscussion('food');
      if (!cancelled) setDiscussed(set);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      // RLS scopes the read to the signed-in user.
      const { data } = await supabase
        .from('food_logs')
        .select('id, happened_at, meal_label, raw_text, kcal, protein_g')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as FoodLogSummary[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, FoodLogSummary[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const avg = weeklyAverage(rows, (iso) => toLocalDateKey(new Date(iso)));

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
          // Disabled rather than hidden: a control that vanishes at the edge
          // reads as a glitch, and its absence would shift the week label.
          disabled={isCurrentWeek}
          onPress={() => setWeekStart((w) => addWeeks(w, 1))}
        />
      </View>

      {/* BACK TO TODAY (Ruth, 2026-09-16: "the scroll back on food log has no way
          back to Today. It needs every page to have a back to today button").
          Stepping back six weeks otherwise means six presses to return, and the
          arrow gives no clue how far from home you are. Shown only when you are
          away from this week: on this week it would do nothing, and a control
          that does nothing is what principle 8 forbids. */}
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
          const totals = sumDay(entries);
          return (
            <ThemedView key={toLocalDateKey(day)} type="backgroundElement" style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <ThemedText type="smallBold">{dayLabel(day)}</ThemedText>
                {entries.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)}g
                  </ThemedText>
                )}
              </View>

              {entries.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nothing logged.
                </ThemedText>
              ) : (
                entries.map((row) => (
                  <View key={row.id} style={styles.row}>
                    <ThemedText type="small" style={styles.label}>
                      {entryLabel(row)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.macros}>
                      {Math.round(row.kcal ?? 0)} kcal · {Math.round(row.protein_g ?? 0)}g
                    </ThemedText>
                    {/* The same affordance as today's log, so an entry opens the
                        same way wherever it is met. */}
                    <Pressable
                      onPress={() => setOpenId(row.id)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        discussed.has(row.id)
                          ? `What's in ${entryLabel(row)} (discussed)`
                          : `What's in ${entryLabel(row)}`
                      }
                      hitSlop={Spacing.two}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                    >
                      <Ionicons
                        name="eye-outline"
                        size={18}
                        color={discussed.has(row.id) ? theme.text : theme.textSecondary}
                      />
                    </Pressable>
                  </View>
                ))
              )}
            </ThemedView>
          );
        })
      )}

      {avg && (
        <ThemedText type="small" themeColor="textSecondary">
          Avg {avg.kcal.toLocaleString()} kcal · {avg.protein}g protein
          {avg.daysLogged < 7 ? ` · ${avg.daysLogged} of 7 days logged` : ''}
        </ThemedText>
      )}

      <FoodBreakdownCard foodLogId={openId} onClose={() => setOpenId(null)} />
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
    alignItems: 'center',
    gap: Spacing.three,
  },
  label: {
    flex: 1,
  },
  // Shrinks and wraps rather than pushing the icon off the edge - the same
  // fault that hid the eye icon on today's log on the widest readings.
  macros: {
    flexShrink: 1,
  },
  iconButton: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});
