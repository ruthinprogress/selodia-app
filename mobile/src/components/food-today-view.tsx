import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FoodBreakdownCard } from '@/components/food-breakdown-card';
import { QuickLogBar } from '@/components/quick-log-bar';
import { SpotlightTarget } from '@/components/spotlight-target';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadEntriesWithDiscussion } from '@/lib/discuss-state';
import { entryLabel, sumDay, weeklyAverage, type FoodLogSummary } from '@/lib/food-today';
import { supabase } from '@/lib/supabase';
import { toLocalDateKey, weekRange } from '@/lib/week';

// The Food segment (UNFLUMP_SPEC.md, The Food Segment): a TODAY'S-LOG view, not
// a browsable week. Today's entries as rows, today's total, and a single
// one-line weekly average. The weekly *table* mechanic is a body-data pattern
// and lives in Measurements — see food-week-view.tsx, parked for that port.
//
// This is also the first real host for the "What's In Here" breakdown card
// (item 13): each row carries the eye icon, and the card itself is
// host-agnostic, so nothing here is load-bearing for it.

export function FoodTodayView() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<FoodLogSummary[]>([]);
  const [avg, setAvg] = useState<{ kcal: number; protein: number; daysLogged: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Which of today's entries already carry a discussion (build item 30). One
  // query for the whole view, not one per row.
  const [discussed, setDiscussed] = useState<Set<string>>(new Set());
  // Bumped by the quick-log bar so the reads below re-run. The whole point of
  // logging on this tab is watching it land on this tab.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const set = await loadEntriesWithDiscussion('food');
      if (!cancelled) setDiscussed(set);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      // One read covers both: this week's rows give the average, and today's
      // subset gives the log. RLS scopes it to the signed-in user.
      const { startISO, endISO } = weekRange(new Date());
      const { data } = await supabase
        .from('food_logs')
        .select('id, happened_at, meal_label, raw_text, kcal, protein_g, confidence')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: true });
      if (cancelled) return;
      const rows = (data ?? []) as FoodLogSummary[];
      setToday(rows.filter((r) => new Date(r.happened_at) >= startOfDay));
      setAvg(weeklyAverage(rows, toLocalDateKey_));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const totals = sumDay(today);

  if (loading) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        …
      </ThemedText>
    );
  }

  return (
    <>
      {/* Above the day, because it is the thing you came here to do. */}
      <QuickLogBar kind="food" onLogged={() => setReloadKey((k) => k + 1)} />

      <ThemedText type="smallBold">Today</ThemedText>

      {today.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged yet · add a meal above whenever you like
        </ThemedText>
      ) : (
        <SpotlightTarget id="food.entries">
        <ThemedView type="backgroundElement" style={styles.card}>
          {today.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.labelCol}>
                <ThemedText type="small">{entryLabel(row)}</ThemedText>
                <Tag context="confidence" value={row.confidence} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(row.kcal ?? 0)} kcal · {Math.round(row.protein_g ?? 0)}g
              </ThemedText>
              {/* The universal "view detail" affordance — icon only, never a
                  repeated text button, which would read as a spreadsheet. */}
              <Pressable
                onPress={() => setOpenId(row.id)}
                accessibilityRole="button"
                accessibilityLabel={
                  discussed.has(row.id)
                    ? `What's in ${entryLabel(row)} (discussed)`
                    : `What's in ${entryLabel(row)}`
                }
                hitSlop={Spacing.two}
                style={({ pressed }) => pressed && styles.pressed}
              >
                {/* Neutral until a discussion exists against this entry, then
                    permanently changed — no third "unread" state, no fading
                    back. ITEM 37 SWAP POINT: theme.text is a placeholder for
                    the brand treatment, which is intended to be genuinely
                    eye-catching (a saturated brand colour, a badge/dot, or a
                    one-time animation) rather than this quiet token shift. */}
                <Ionicons
                  name="eye-outline"
                  size={18}
                  color={discussed.has(row.id) ? theme.text : theme.textSecondary}
                />
              </Pressable>
            </View>
          ))}

          <View style={styles.totalRow}>
            <ThemedText type="smallBold">Total</ThemedText>
            <ThemedText type="smallBold">
              {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)}g
            </ThemedText>
          </View>
        </ThemedView>
        </SpotlightTarget>
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

const toLocalDateKey_ = (iso: string) => toLocalDateKey(new Date(iso));

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  labelCol: {
    flex: 1,
    gap: Spacing.half,
    alignItems: 'flex-start',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
