import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buildDaySummaryRows, type DayLog } from '@/lib/food-breakdown-table';
import { supabase } from '@/lib/supabase';

// WHAT WENT IN, WHEN A TURN LOGGED SEVERAL MEALS AT ONCE (2026-10-04).
//
// Ruth, after voice-logging a whole Saturday: "no summary table came through in
// the chat to show what was logged."
//
// FoodBreakdownTable draws ONE meal, itemised. A turn that logs a whole day used
// to draw nothing at all - food_log_id was set to null whenever there was more
// than one entry, on the reasoning that picking one of seven would show that
// day's breakdown under a reply about the week. True, and the conclusion was
// wrong: she was left with a sentence claiming a save and no way to check it.
//
// A MEAL PER ROW, NOT AN ITEM PER ROW. Itemising four meals here would be thirty
// lines in a chat bubble. This answers the question she actually has - did it get
// all of it, and roughly what was that - and each entry still opens its full
// breakdown from the log.
//
// IT READS THE ROWS, IT DOES NOT RETELL THEM. Same rule as the itemised table:
// the figures come from food_logs, never from anything the model wrote, so the
// summary cannot quietly disagree with what was stored.

export function DaySummaryTable({ foodLogIds }: { foodLogIds: string[] }) {
  const theme = useTheme();
  const [logs, setLogs] = useState<DayLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (foodLogIds.length === 0) {
        setLogs([]);
        return;
      }
      const { data, error } = await supabase
        .from('food_logs')
        .select('id, meal_label, raw_text, happened_at, kcal, protein_g')
        .in('id', foodLogIds);
      if (cancelled) return;
      // A FAILED READ DRAWS NOTHING RATHER THAN A WRONG TOTAL. The reply above
      // already says what was logged; an empty or partial table underneath it
      // would be the app contradicting itself.
      setLogs(error ? [] : ((data ?? []) as DayLog[]));
    })();
    return () => {
      cancelled = true;
    };
  }, [foodLogIds.join(',')]);

  if (!logs || logs.length === 0) return null;

  const rows = buildDaySummaryRows(logs);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {rows.map((row) => (
        <View
          key={row.key}
          style={[
            styles.row,
            row.isTotal && { borderTopWidth: 1, borderTopColor: theme.background },
          ]}>
          <ThemedText
            type={row.isTotal ? 'smallBold' : 'small'}
            style={styles.label}
            numberOfLines={2}>
            {row.label}
          </ThemedText>
          <ThemedText
            type={row.isTotal ? 'smallBold' : 'small'}
            themeColor={row.isTotal ? 'text' : 'textSecondary'}
            style={styles.figure}>
            {row.kcal}
          </ThemedText>
          <ThemedText
            type={row.isTotal ? 'smallBold' : 'small'}
            themeColor={row.isTotal ? 'text' : 'textSecondary'}
            style={styles.figure}>
            {row.protein}
          </ThemedText>
        </View>
      ))}
      {/* SAID ONCE, QUIETLY. Every figure above is an estimate and the "~" says
          so on each one; this says where to go for the detail rather than
          apologising for the numbers. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Tap any meal in your log to see what is in it.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: 2 },
  label: { flexGrow: 1, flexShrink: 1 },
  // Tabular figures so the columns line up down the card rather than drifting
  // with the digits.
  figure: { minWidth: 54, textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { paddingTop: Spacing.one },
});
