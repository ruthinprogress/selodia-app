import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FoodBreakdownCard } from '@/components/food-breakdown-card';
import { RowDelete } from '@/components/row-delete';
import { LogInChatHint } from '@/components/log-in-chat-hint';
import { QuickLogBar } from '@/components/quick-log-bar';
import { SpotlightTarget } from '@/components/spotlight-target';
import { FoodCategoryIcon } from '@/components/food-category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadEntriesWithDiscussion } from '@/lib/discuss-state';
import { foodCategory } from '@/lib/food-category';
import { entryLabel, sumDay, weeklyAverage, type FoodLogSummary } from '@/lib/food-today';
import { supabase } from '@/lib/supabase';
import { currentWeekStart, toLocalDateKey, weekRange } from '@/lib/week';

// The Food segment (SELODIA_SPEC.md, The Food Segment): a TODAY'S-LOG view, not
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
      //
      // currentWeekStart(), NOT new Date() (fixed 2026-09-16). weekRange takes a
      // week START and does not snap to one, so passing "now" asked for today
      // plus the next six days - a window mostly in the future. The average
      // underneath today's log has therefore been computed over the wrong seven
      // days since it was built, and read as missing whenever today was empty.
      const { startISO, endISO } = weekRange(currentWeekStart());
      const { data } = await supabase
        .from('food_logs')
        .select('id, happened_at, meal_label, raw_text, kcal, protein_g')
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

      <LogInChatHint tab="food" />

      {/* TWO WAYS BACK, ON PURPOSE, FOR NOW (Ruth, 2026-09-16). An arrow beside
          the heading is what every other app puts there and what a thumb reaches
          for; the "Earlier weeks" link below is explicit and unmissable. She
          asked for both so she can live with them and see which one she actually
          uses. One of them comes out once that is known - a screen with two
          controls doing the same thing is a decision left unmade. */}
      <View style={styles.todayHeader}>
        <Pressable
          onPress={() => router.push('/log/food-history')}
          accessibilityRole="button"
          accessibilityLabel="Earlier weeks"
          hitSlop={Spacing.three}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </Pressable>
        <ThemedText type="smallBold">Today</ThemedText>
      </View>

      {today.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged yet · add a meal above whenever you like
        </ThemedText>
      ) : (
        <SpotlightTarget id="food.entries">
        <ThemedView type="backgroundElement" style={styles.card}>
          {today.map((row) => (
            <View key={row.id} style={styles.row}>
              {/* THE CATEGORY, NOT THE DISH (UI brief, 2026-09-17). A bowl, a
                  cup, a plate or a leaf, read off the words she wrote. Hidden
                  from screen readers: the entry's own text says what it is, and
                  an icon that announces "meal" beside "Turkish leftovers box"
                  is a second, worse name for the same row. */}
              <FoodCategoryIcon category={foodCategory(row)} size={20} />
              <View style={styles.labelCol}>
                <ThemedText type="small">{entryLabel(row)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.macros}>
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
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
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
              {/* Delete, on the row (Ruth, 2026-09-18). See row-delete.tsx for
                  the evening that made reaching it through the card untenable. */}
              <RowDelete
                table="food_logs"
                id={row.id}
                what={entryLabel(row)}
                onDeleted={() => setReloadKey((k) => k + 1)}
              />
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

      {/* The way back through the weeks (2026-09-16). Seven days caught up in
          chat landed in last week, and this view only ever shows today, so
          there was nowhere to go and look at them. */}
      <Pressable
        onPress={() => router.push('/log/food-history')}
        accessibilityRole="button"
        accessibilityLabel="Earlier weeks"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="accentDeep">
          Earlier weeks
        </ThemedText>
      </Pressable>

      <FoodBreakdownCard
        foodLogId={openId}
        onClose={() => setOpenId(null)}
        onDeleted={() => {
          setOpenId(null);
          setReloadKey((k) => k + 1);
        }}
      />
    </>
  );
}

const toLocalDateKey_ = (iso: string) => toLocalDateKey(new Date(iso));

const styles = StyleSheet.create({
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Tighter than the old three-column gap: the icon belongs to the words
    // beside it, so it sits closer to them than the macros do.
    gap: Spacing.two,
  },
  labelCol: {
    flex: 1,
    gap: Spacing.half,
    alignItems: 'flex-start',
  },
  // The macros used to be the one item in this row that could not give ground.
  // flexShrink defaults to 0 in React Native, so once labelCol had shrunk to
  // its floor, a wide reading ("1,234 kcal · 123g") kept its full single-line
  // width and pushed the eye icon off the right edge of the card - the row's
  // only control, gone, on exactly the entries with the biggest numbers. That
  // is why it looked intermittent. Now it shrinks and wraps instead, which
  // costs a line of height and loses nothing.
  macros: {
    flexShrink: 1,
  },
  // And the icon never shrinks, so it cannot be squeezed to nothing by the
  // fix above.
  iconButton: {
    flexShrink: 0,
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
