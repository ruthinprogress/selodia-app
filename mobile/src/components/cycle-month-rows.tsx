import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { rowDetail, rowLength, type CycleMonth } from '@/lib/cycle-months';

// THE LIST OF MONTHS, FROM HER ARTWORK (21 October 2026).
//
// Screen 1: a year heading, then one row per cycle - the month on the left, the
// length on the right, a bar underneath and a chevron. The current one sits at
// the top on its own ground, because it is the one she is living in.
//
// THE BAR IS THE CYCLE, AND THE DARK PART IS THE BLEED. It is drawn to the same
// scale across every row - a 34-day cycle's bar is genuinely longer than a
// 28-day one's - so the shape of her year is readable at a glance without
// reading a single number. That is the whole reason the drawing has bars at all.
//
// AND A CYCLE WITH NO END LOGGED DRAWS NO DARK PART, rather than guessing at
// four or five days. The row says "End not logged" in words beside it; drawing
// an average bleed there would quietly turn a gap in the record into a fact.

/** The longest bar any row may draw, as a share of the row's width. */
const LONGEST = 40;

function Bar({ row, muted }: { row: CycleMonth; muted: boolean }) {
  const theme = useTheme();
  // Days, capped so one wildly long cycle cannot squash every other row flat.
  const span = Math.min(row.lengthDays ?? row.dayOfCycle ?? 0, LONGEST);
  const bleed = Math.min(row.bleedDays ?? 0, span);
  if (span <= 0) return null;
  return (
    <View style={styles.bar} accessible={false}>
      {bleed > 0 && (
        <View
          style={[styles.segment, { flex: bleed, backgroundColor: theme.accent, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]}
        />
      )}
      <View
        style={[
          styles.segment,
          {
            flex: span - bleed,
            backgroundColor: muted ? theme.accentWash : theme.backgroundElement,
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
            borderTopLeftRadius: bleed > 0 ? 0 : 3,
            borderBottomLeftRadius: bleed > 0 ? 0 : 3,
          },
        ]}
      />
      {/* The rest of the longest bar, left empty, so every row shares one scale. */}
      {span < LONGEST && <View style={{ flex: LONGEST - span }} />}
    </View>
  );
}

export function CycleMonthRow({
  row,
  title,
  current,
  onPress,
}: {
  row: CycleMonth;
  title: string;
  current?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const length = rowLength(row);
  const detail = rowDetail(row);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // READ ALOUD AS ONE SENTENCE. Four separate labels would be read as four
      // things, and this row is one thing: a cycle, how long, how it went.
      accessibilityLabel={`${title}. ${length}. ${detail}.`}
      accessibilityHint="Opens this cycle"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <ThemedView
        type={current ? 'backgroundElement' : 'background'}
        style={[styles.row, current && { borderRadius: CardRadius }]}
      >
        <View style={styles.rowText}>
          <View style={styles.rowTop}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <View style={styles.spacer} />
            <ThemedText type="small" themeColor="textSecondary">
              {length}
            </ThemedText>
          </View>
          <Bar row={row} muted={current === true} />
          <ThemedText type="detail" themeColor="textSecondary">
            {detail}
          </ThemedText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  // FILLS THE ROW, never hugs its own measured width. The segmented tabs needed
  // four attempts to learn this and the fix was one word: a label that sizes
  // itself to its text clips the moment the text is a pixel wider than the
  // measurement that was taken.
  rowText: { flex: 1, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  spacer: { flex: 1 },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  segment: { height: 6 },
  pressed: { opacity: 0.6 },
});
