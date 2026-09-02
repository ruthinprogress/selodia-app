import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buildThenAndNow, formatPercent, type Reading, type ThenAndNow } from '@/lib/then-and-now';
import { supabase } from '@/lib/supabase';

// "Then & Now" (build item 16, slice 3 of item 38 — Part Five).
//
// Sits under the weekly table and the metrics table, in the segment someone
// chooses to open. Part Five is explicit that these numbers "stay in a view
// someone chooses to open, never on the default landing, because surfacing them
// on every open reads as intrusive" — a first-versus-latest comparison is the
// most loaded thing on the screen, and it should be looked for, not served up.
//
// THE READINGS ARE SHOWN, NOT JUST THE PERCENTAGE. The spec's reason for
// preferring a table over a chart is that a table "grounds any delta in the real
// numbers it came from rather than presenting an abstract figure", so a row that
// showed only "−5.2%" would be the chart's failure in table clothing.
//
// NO COLOUR ON DIRECTION. A green fall and a red rise would make the app rule on
// which way a body is supposed to go — the verdict principle 2 rules out, and
// wrong for anyone whose focus is gain. Direction is carried by the sign and the
// two numbers either side of it.

export function ThenAndNowTable() {
  const [data, setData] = useState<ThenAndNow | null>(null);
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ALL readings, not a window: "then" means the first one there has ever
      // been. RLS scopes this to the signed-in person.
      const { data: rows, error } = await supabase
        .from('body_measurements')
        .select('measured_at, weight_kg, muscle_kg')
        .order('measured_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        // Fall through to the empty state rather than an error block: a quiet
        // "not yet" on a comparison someone opened deliberately is far better
        // than a failure message where their progress should be.
        setData({ rows: [], emptyReason: 'no_readings' });
        return;
      }
      const readings: Reading[] = (rows ?? []).map((r) => ({
        measuredAt: String(r.measured_at ?? ''),
        weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
        muscleKg: r.muscle_kg == null ? null : Number(r.muscle_kg),
      }));
      setData(buildThenAndNow(readings));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>
        Then &amp; Now
      </ThemedText>

      {data.rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          {data.emptyReason === 'no_readings'
            ? 'Nothing to compare yet. This fills in once there are readings to look back on.'
            : 'One reading so far. This shows the change once there are two to compare.'}
        </ThemedText>
      ) : (
        <ThemedView type="backgroundElement" style={styles.table}>
          <View style={[styles.row, styles.headRow, { borderBottomColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.cellLabel}>
              {' '}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.cellNum}>
              Then
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.cellNum}>
              Now
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.cellPct}>
              Change
            </ThemedText>
          </View>

          {data.rows.map((r, i) => (
            <View
              key={r.label}
              style={[
                styles.row,
                i < data.rows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.backgroundSelected,
                },
              ]}
            >
              <ThemedText type="small" style={styles.cellLabel} selectable>
                {r.label}
              </ThemedText>
              <View style={styles.cellNum}>
                <ThemedText type="smallBold" style={styles.right} selectable>
                  {r.thenValue}
                  {r.unit}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.right}>
                  {r.thenDate.slice(0, 10)}
                </ThemedText>
              </View>
              <View style={styles.cellNum}>
                <ThemedText type="smallBold" style={styles.right} selectable>
                  {r.nowValue}
                  {r.unit}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.right}>
                  {r.nowDate.slice(0, 10)}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.cellPct} selectable>
                {formatPercent(r.percentChange)}
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.six },
  heading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.one,
  },
  empty: { paddingHorizontal: Spacing.one, lineHeight: 20 },
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
  headRow: { borderBottomWidth: StyleSheet.hairlineWidth },
  cellLabel: { flex: 1.1 },
  cellNum: { width: 74, alignItems: 'flex-end' },
  cellPct: { width: 62, textAlign: 'right' },
  right: { textAlign: 'right' },
});
