import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { perItemProteinFlag } from '@/lib/protein-quality';
import type { ProteinSource } from '@/lib/protein-quality';
import { supabase } from '@/lib/supabase';

// The "What's In Here" breakdown card (build item 13) — the READ-ONLY half of
// the discuss-card. Deliberately host-agnostic: it takes a `food_logs.id` and
// nothing else, so the same card serves today's-log rows now and any future
// host (a weekly table, a chat deep-link) without change.
//
// Follows the Detail Views template (SELODIA_SPEC.md) in order: the itemised
// content, then the macro breakdown with its confidence tag. The template's
// other two parts are deliberately ABSENT, not forgotten:
//   - the sand-toned factual note card needs per-entry health flags, which are
//     point-in-time records (build item 29) — computing one live here would
//     contradict exactly what item 29 exists to guarantee;
//   - the sage insight card needs per-entry insight generation (items 29/30).
// The "Ask about this" button belongs to item 30 (repost-to-chat). Rendering it
// now would be a dead control — the thing principle 8 forbids — so it arrives
// with the behaviour behind it.

type FoodLog = {
  meal_label: string | null;
  raw_text: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: string | null;
  breakdown_type: string | null;
  protein_source: string | null;
};

type FoodItem = {
  id: string;
  name: string;
  quantity: string | null;
  kcal: number | null;
  protein_g: number | null;
  protein_source: string | null;
};

const g = (n: number | null): string => (n == null ? '—' : `${Math.round(n)}g`);
const kcal = (n: number | null): string => (n == null ? '—' : `${Math.round(n)} kcal`);

export function FoodBreakdownCard({
  foodLogId,
  onClose,
}: {
  foodLogId: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<FoodLog | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);

  useEffect(() => {
    if (!foodLogId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // RLS scopes both reads to the signed-in user.
      const [{ data: logRow }, { data: itemRows }] = await Promise.all([
        supabase
          .from('food_logs')
          .select(
            'meal_label, raw_text, kcal, protein_g, carbs_g, fat_g, confidence, breakdown_type, protein_source'
          )
          .eq('id', foodLogId)
          .maybeSingle(),
        supabase
          .from('food_items')
          .select('id, name, quantity, kcal, protein_g, protein_source')
          .eq('food_log_id', foodLogId)
          .order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      setLog((logRow ?? null) as FoodLog | null);
      setItems((itemRows ?? []) as FoodItem[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [foodLogId]);

  // Two real cases produce no rows in food_items, and neither is an error:
  //   - a 'simple' log (an apple, a branded yoghurt) is never itemised by design;
  //   - a log predating item 11 was written before food_items existed.
  // Both fall back to the log's own description and macros, so the card always
  // says something true rather than showing an empty ingredient list.
  const hasItems = items.length > 0;

  return (
    <Modal
      visible={foodLogId != null}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Tapping the dimmed backdrop dismisses; the card itself swallows the tap. */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <ThemedView style={styles.card}>
            {loading || !log ? (
              <ThemedText type="small" themeColor="textSecondary">
                …
              </ThemedText>
            ) : (
              <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.headerRow}>
                  <ThemedText type="smallBold" style={styles.title}>
                    {log.meal_label ?? log.raw_text ?? 'This entry'}
                  </ThemedText>
                  <Tag context="confidence" value={log.confidence} />
                </View>

                {hasItems ? (
                  <View style={styles.section}>
                    {items.map((it) => {
                      const flag = perItemProteinFlag(
                        it.protein_source as ProteinSource | null,
                        it.protein_g
                      );
                      return (
                        <View key={it.id} style={styles.itemRow}>
                          <View style={styles.itemName}>
                            <ThemedText type="small">
                              {it.name}
                              {it.quantity ? ` ${it.quantity}` : ''}
                            </ThemedText>
                            {/* Per-item protein flag (item 12's other half): collagen
                                reads "incomplete", plant reads "pair it", animal and
                                unclassified read nothing at all. */}
                            {flag && (
                              <ThemedText type="small" themeColor="textSecondary" style={styles.flag}>
                                {flag}
                              </ThemedText>
                            )}
                          </View>
                          <ThemedText type="small" themeColor="textSecondary">
                            {kcal(it.kcal)}
                            {it.protein_g != null ? ` · ${g(it.protein_g)}` : ''}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.section}>
                    {log.raw_text
                      ? `Logged as “${log.raw_text}”.`
                      : 'Logged as a single item.'}
                  </ThemedText>
                )}

                <ThemedView type="backgroundElement" style={styles.macros}>
                  <Macro label="Calories" value={kcal(log.kcal)} />
                  <Macro label="Protein" value={g(log.protein_g)} />
                  <Macro label="Carbs" value={g(log.carbs_g)} />
                  <Macro label="Fat" value={g(log.fat_g)} />
                </ThemedView>
              </ScrollView>
            )}
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macro}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.macroLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Colour comes from theme.scrim at render; only the geometry lives here.
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  cardWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    maxHeight: '100%',
  },
  scroll: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  flag: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  macros: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  macro: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  macroLabel: {
    fontSize: 11,
  },
});
