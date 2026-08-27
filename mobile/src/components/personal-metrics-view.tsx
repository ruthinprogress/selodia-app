import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatChange,
  formatValue,
  formatWhen,
  summariseMetrics,
  type PersonalMetricRow,
} from '@/lib/personal-metrics';
import { supabase } from '@/lib/supabase';

// The second Measurements table: everything a scale does not read.
//
// Stacked under the weekly scale table on one continuous screen, both visible
// together, no toggle (Ruth's decision, 2026-08-27) - so the full picture reads
// at a glance rather than needing a switch between two halves of one body.
//
// Transposed relative to the table above it: one row per METRIC, not per day.
// See personal-metrics.ts for why - in short, a week grid would be almost
// entirely empty for metrics logged at different rhythms, which is the
// empty-cell problem the split exists to prevent, rebuilt one level down.

export const PERSONAL_EMPTY_HEADING = 'Nothing else tracked yet';
export const PERSONAL_EMPTY_BODY =
  "Anything you measure yourself lives here — a waist, a resting heart rate, whatever you find worth watching. Tell me a number in Chat and it'll appear.";

export function PersonalMetricsView() {
  const theme = useTheme();
  const [rows, setRows] = useState<PersonalMetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes this to the signed-in user. Unlike the scale table above,
      // this reads the WHOLE history rather than a week: the view is
      // latest-per-metric with its previous reading, and for something measured
      // monthly the previous reading is nowhere near the displayed week.
      const { data } = await supabase
        .from('personal_metrics')
        .select('id, metric_name, value, value_secondary, unit, measured_at, created_at')
        .order('measured_at', { ascending: false });
      if (cancelled) return;
      setRows((data ?? []) as PersonalMetricRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Silent while loading rather than flashing the empty state at someone who
  // does have metrics - "nothing here yet" that turns out to be wrong is worse
  // than a beat of nothing.
  if (loading) return null;

  const metrics = summariseMetrics(rows);

  return (
    <ThemedView style={styles.wrap}>
      <ThemedText type="smallBold" style={styles.title}>
        Everything else
      </ThemedText>

      {metrics.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.empty} accessibilityRole="summary">
          <ThemedText type="smallBold" style={styles.emptyHeading}>
            {PERSONAL_EMPTY_HEADING}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
            {PERSONAL_EMPTY_BODY}
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedView
          type="backgroundElement"
          style={[styles.table, { borderColor: theme.backgroundSelected }]}
        >
          <View style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellName}>
              Metric
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellValue}>
              Latest
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellMeta}>
              Change
            </ThemedText>
          </View>

          {metrics.map((m, i) => {
            const change = formatChange(m);
            return (
              <View
                key={m.name}
                style={[
                  styles.row,
                  i < metrics.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
                  { borderBottomColor: theme.backgroundSelected },
                ]}
              >
                <ThemedText type="small" style={styles.cellName} selectable>
                  {m.name}
                </ThemedText>
                <View style={styles.cellValue}>
                  <ThemedText type="smallBold" style={styles.right} selectable>
                    {formatValue(m.latest)}
                  </ThemedText>
                  {/* When it was taken sits under the value rather than in its
                      own column: three columns already fill a phone, and "how
                      long ago" only ever qualifies the number above it. */}
                  <ThemedText type="small" themeColor="textSecondary" style={styles.right}>
                    {formatWhen(m.latest.measured_at)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.cellMeta}>
                  {/* An em dash, not a zero: no previous reading is not "no
                      change", and the two must never look the same. */}
                  {change ?? '—'}
                </ThemedText>
              </View>
            );
          })}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    marginTop: Spacing.six,
  },
  title: {
    paddingHorizontal: Spacing.one,
  },
  table: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  cellName: {
    flex: 1,
  },
  cellValue: {
    width: 92,
    alignItems: 'flex-end',
  },
  cellMeta: {
    width: 78,
    textAlign: 'right',
  },
  right: {
    textAlign: 'right',
  },
  empty: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  emptyHeading: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
});
