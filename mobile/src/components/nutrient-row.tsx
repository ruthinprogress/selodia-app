import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NutrientIcon } from '@/components/nutrient-icon';
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

/**
 * Which marks are sage and which terracotta.
 *
 * TWO COLOURS, NOT TEN. The brand has a terracotta and a sage, and a tint per
 * nutrient would be ten hues nobody chose. Sage is what builds - the grain,
 * the leaf, the bone - and terracotta is everything else.
 */
const SAGE = new Set<MacroKey>(['carbs', 'fibre', 'calcium']);

export function NutrientRow({ macroKey, label }: { macroKey: MacroKey; label: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const e = explainerFor(macroKey);
  if (!e) return null;

  const sage = SAGE.has(macroKey);
  const tint = sage ? theme.sage : theme.accentDeep;

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
        <View style={[styles.badge, { backgroundColor: sage ? theme.background : theme.accentWash }]}>
          <NutrientIcon macroKey={macroKey} size={18} color={tint} />
        </View>
        {/* FILLS THE ROW rather than hugging its own measured width, so a long
            line wraps instead of clipping. The segmented tabs took four
            attempts to learn this and the fix was one word. */}
        <View style={styles.words}>
          <ThemedText type="small" style={styles.name}>
            {label}
          </ThemedText>
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
            <NutrientIcon macroKey="fibre" size={18} color={theme.sage} />
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
  card: { borderRadius: CardRadius, marginBottom: Spacing.one, overflow: 'hidden' },
  // TIGHTER (Ruth, 22 October 2026): "Shrink size down a bit, it feels a bit
  // too spread out."
  //
  // The name was `subtitle`, which is 24 - a heading size, ten times down a
  // page, each in a 44-pixel badge row with 16 of padding either side. Every
  // one of those was defensible alone and together they made a list you scroll
  // rather than scan. Four rows filled the screen.
  //
  // The row still clears 44 overall, which is the smallest a tappable thing is
  // allowed to be here - that floor is not style and does not move.
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, gap: 1 },
  // 18, between the log's body at 14 and the old heading at 24. It is a name
  // in a list, not a title.
  name: { fontSize: 18, lineHeight: 23 },
  line: { lineHeight: 18 },
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
