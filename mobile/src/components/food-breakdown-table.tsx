import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  breakdownHeading,
  buildBreakdownRows,
  type BreakdownItem,
} from '@/lib/food-breakdown-table';
import { aminoProfile, mealAminoAssessment } from '@/lib/protein-quality';
import { supabase } from '@/lib/supabase';

// The itemised breakdown rendered INTO the chat thread when food is logged
// (2026-08-27). Nutrition literacy is the point: seeing which item carried the
// protein, in the moment, is what a total can never teach.
//
// A real table, not markdown. The chat has no markdown renderer, and adding one
// would have meant parsing numbers back out of the model's prose - see
// food-breakdown-table.ts for why that trade was refused. This reads food_items
// directly, so what is on screen is what is in the database.
//
// Distinct from food-breakdown-card.tsx, which is the tap-to-open MODAL for a
// logged row. Same data, different moment: that one is looked up deliberately,
// this one arrives unbidden in the thread, so it is quieter - no confidence tag,
// no macro grid, just the rows, the total, and one line underneath.

type FoodLog = { meal_label: string | null; happened_at: string | null };

export function FoodBreakdownTable({ foodLogId }: { foodLogId: string }) {
  const theme = useTheme();
  const [log, setLog] = useState<FoodLog | null>(null);
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes both reads to the signed-in user.
      const [{ data: logRow }, { data: itemRows }] = await Promise.all([
        supabase
          .from('food_logs')
          .select('meal_label, happened_at')
          .eq('id', foodLogId)
          .maybeSingle(),
        supabase
          .from('food_items')
          .select('id, name, quantity, kcal, protein_g, protein_source, amino_profile')
          .eq('food_log_id', foodLogId)
          .order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      setLog((logRow ?? null) as FoodLog | null);
      setItems((itemRows ?? []) as BreakdownItem[]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [foodLogId]);

  // Two real cases produce no rows and neither is an error: a 'simple' log (an
  // apple, a branded yoghurt) is never itemised by design, and a log predating
  // item 11 was written before food_items existed. A one-row table teaches
  // nothing, so the turn simply renders as an ordinary reply - the same reason
  // principle 8 forbids empty sections.
  if (!loaded || items.length === 0) return null;

  const rows = buildBreakdownRows(items);
  const heading = breakdownHeading(log?.happened_at ?? null, log?.meal_label ?? null);
  // Assessed over the WHOLE meal, not per item. Mapping a per-item flag into a
  // sentence is what told Ruth to add dairy to a breakfast containing yoghurt:
  // a flag scoped to one item silently becomes a claim about the meal once it
  // is written as prose. See mealAminoAssessment for the reasoning it replaced.
  const assessment = mealAminoAssessment(
    items.map((i) => ({
      name: i.name,
      proteinG: i.protein_g,
      aminoProfile: aminoProfile(i.amino_profile),
    }))
  );

  return (
    <ThemedView style={styles.wrap}>
      {heading.length > 0 && (
        <ThemedText type="smallBold" style={styles.heading}>
          {heading}
        </ThemedText>
      )}

      <ThemedView
        type="backgroundElement"
        style={[styles.table, { borderColor: theme.backgroundSelected }]}
        // One node to the screen reader, read in order, rather than a stream of
        // loose numbers with no idea which item they belong to.
        accessibilityRole="summary"
        accessibilityLabel={`${heading}. ${rows
          .map((r) => `${r.label}, ${r.kcal} kcal, ${r.protein} protein`)
          .join('. ')}`}
      >
        <View style={[styles.row, styles.headerRow, { borderBottomColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellLabel}>
            Meal
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellNum}>
            Kcal
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellNum}>
            Protein
          </ThemedText>
        </View>

        {rows.map((r, i) => (
          <View
            key={r.key}
            style={[
              styles.row,
              // No rule under the last row: the table's own border closes it.
              i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
              { borderBottomColor: theme.backgroundSelected },
              r.isTotal && [styles.totalRow, { borderTopColor: theme.backgroundSelected }],
            ]}
          >
            <ThemedText type={r.isTotal ? 'smallBold' : 'small'} style={styles.cellLabel} selectable>
              {r.label}
            </ThemedText>
            <ThemedText type={r.isTotal ? 'smallBold' : 'small'} style={styles.cellNum} selectable>
              {r.kcal}
            </ThemedText>
            <ThemedText type={r.isTotal ? 'smallBold' : 'small'} style={styles.cellNum} selectable>
              {r.protein}
            </ThemedText>
          </View>
        ))}
      </ThemedView>

      {assessment && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.commentary}>
          {assessment.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    // Matches the assistant bubble's own inset so the table reads as part of
    // that turn rather than as a separate posted object.
    maxWidth: '95%',
    alignSelf: 'flex-start',
    width: '100%',
  },
  heading: {
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
  headerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // The label takes the slack; the numeric columns are fixed so digits line up
  // down the column, which is the whole reason this is a table and not a list.
  cellLabel: {
    flex: 1,
  },
  cellNum: {
    width: 62,
    textAlign: 'right',
  },
  commentary: {
    paddingHorizontal: Spacing.one,
  },
});
