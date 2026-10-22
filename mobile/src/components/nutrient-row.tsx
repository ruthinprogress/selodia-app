import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { explainerFor } from '@/lib/macro-explainers';
import type { MacroKey } from '@/lib/tracked-macros';

// ONE NUTRIENT, SHUT UNTIL SHE ASKS (Ruth's artwork, 22 October 2026).
//
// Her instruction with it: "nutrients page explainer is collapsible rows, not
// a long list of unreadable pills."
//
// What shipped yesterday was ten cards, each three paragraphs, all open. Every
// word of it was worth reading and none of it was readable, because a screen
// that answers ten questions at once answers none of them - you cannot find
// fibre without reading about saturated fat first.
//
// SHUT, A ROW ANSWERS BY ITSELF. The one line under the name is the whole
// point of the change: somebody scanning for what fibre is does not open
// anything. The paragraph is for the once or twice she wants more.
//
// THE CHEVRON IS HERS, NOT THE DRAWING'S (14 October 2026): "The need to point
// to the header and then point down when open." Her artwork draws these
// down-then-up, which is the convention she ruled against on the Me tab, and
// a check enforces her version app-wide. Asked about it directly, she said
// keep the rule. Same answer as the Cycle fold last night.

/** The mark and its tint. Terracotta for what fuels, sage for what builds. */
const MARK: Record<MacroKey, { icon: keyof typeof MaterialCommunityIcons.glyphMap; sage?: boolean }> = {
  kcal: { icon: 'white-balance-sunny' },
  protein: { icon: 'molecule' },
  fat: { icon: 'water-outline' },
  saturated: { icon: 'water-percent' },
  carbs: { icon: 'barley', sage: true },
  sugar: { icon: 'cube-outline' },
  fibre: { icon: 'sprout', sage: true },
  salt: { icon: 'shaker-outline' },
  // The two she asked for, and the two that earn their colour: bone and blood.
  calcium: { icon: 'bone', sage: true },
  iron: { icon: 'water' },
};

export function NutrientRow({ macroKey, label }: { macroKey: MacroKey; label: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const e = explainerFor(macroKey);
  if (!e) return null;

  const mark = MARK[macroKey];
  const tint = mark.sage ? theme.sage : theme.accentDeep;

  return (
    <ThemedView
      type={open ? 'backgroundElement' : 'background'}
      style={[styles.card, open && { backgroundColor: theme.backgroundElement }]}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}. ${e.line}`}
        accessibilityHint={open ? 'Folds this away' : 'Explains what it does and where it comes from'}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={[styles.badge, { backgroundColor: mark.sage ? theme.background : theme.accentWash }]}>
          <MaterialCommunityIcons name={mark.icon} size={20} color={tint} />
        </View>
        {/* FILLS THE ROW rather than hugging its own measured width, so a long
            line wraps instead of clipping. The segmented tabs took four
            attempts to learn this and the fix was one word. */}
        <View style={styles.words}>
          <ThemedText type="subtitle">{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
            {e.line}
          </ThemedText>
        </View>
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={theme.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.body}>
          <View style={[styles.rule, { backgroundColor: theme.background }]} />
          <ThemedText type="small" style={styles.prose}>
            {e.what}
          </ThemedText>

          {/* WHERE IT COMES FROM, in its own panel as the artwork has it. The
              foods are the part somebody acts on, so they are not left as a
              fourth paragraph of the same block. */}
          <ThemedView type="background" style={styles.where}>
            <MaterialCommunityIcons name="sprout" size={18} color={theme.sage} style={styles.whereMark} />
            <View style={styles.words}>
              <ThemedText type="detail" themeColor="textSecondary" style={styles.eyebrow}>
                Where it comes from
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.prose}>
                {e.where}
              </ThemedText>
            </View>
          </ThemedView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, marginBottom: Spacing.two, overflow: 'hidden' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    minHeight: 44,
  },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, gap: 2 },
  line: { lineHeight: 19 },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.three },
  rule: { height: 1, marginBottom: Spacing.one },
  // The one screen in the app with paragraphs on it. The default leading is
  // set for labels and single lines.
  prose: { lineHeight: 21 },
  where: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  whereMark: { marginTop: 2 },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
  pressed: { opacity: 0.6 },
});
