import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MACROS, macroFigure, type MacroKey } from '@/lib/tracked-macros';

// THE WEEK, AS FIGURES RATHER THAN A SENTENCE (Ruth's artwork, 22 October 2026).
//
// Yesterday this card said its average as one running line - "1,045 kcal · 60 g
// protein · 43 g fat · 16 g saturated fat · 98 g carbohydrates..." - which is
// every number she asked for, in the order she asked for them, and unreadable.
// Eight figures in a sentence is a sentence nobody finishes.
//
// Her drawing lays them out as columns: the figure large, its name under it,
// hairlines between. The eye can land on one.
//
// AND THE TWO SUBORDINATE ONES SIT UNDER THEIR PARENT. Saturated fat belongs to
// fat and sugar belongs to carbohydrate - they are not two more of the same
// kind of thing, and the drawing shows that by nesting them rather than by
// giving them columns of their own. It is the only hierarchy in the card and it
// is the one that stops eight columns reading as eight equals.

/** The two that are a part of something else, and what they sit under. */
const UNDER: Partial<Record<MacroKey, MacroKey>> = {
  saturated: 'fat',
  sugar: 'carbs',
};

export function WeekAverageCard({
  averages,
  tracked,
  daysLogged,
}: {
  /** The per-day average for each macro, keyed by column, already divided. */
  averages: Record<string, number>;
  tracked: MacroKey[];
  daysLogged: number;
}) {
  const theme = useTheme();

  const figure = (key: MacroKey) => {
    const spec = MACROS.find((m) => m.key === key);
    if (!spec || averages[spec.column] == null) return null;
    return macroFigure(key, averages);
  };

  // Only the ones she tracks, only the ones with a figure, and the two
  // subordinates pulled out so they can be drawn under their parent.
  const columns = MACROS.filter((m) => tracked.includes(m.key) && !UNDER[m.key] && figure(m.key));

  if (columns.length === 0) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        {/* FILLS THE ROW, so the link stays pinned right however long the
            heading runs. */}
        <View style={styles.heading}>
          <ThemedText type="subtitle">Daily average this week</ThemedText>
          {/* THE COUNT SITS WITH THE HEADING, not with the figures. An average
              of four days is a different claim from an average of seven, and
              that belongs to the title rather than to any one number. */}
          <ThemedText type="detail" themeColor="textSecondary">
            {daysLogged} of 7 days logged
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/log/nutrients')}
          accessibilityRole="button"
          accessibilityLabel="What these nutrients mean"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <ThemedText type="small" themeColor="link">
            What these mean
          </ThemedText>
          <Ionicons name="chevron-forward" size={14} color={theme.link} />
        </Pressable>
      </View>

      <View style={styles.figures}>
        {columns.map((m, i) => {
          const child = (Object.keys(UNDER) as MacroKey[]).find(
            (k) => UNDER[k] === m.key && tracked.includes(k) && figure(k)
          );
          return (
            <View key={m.key} style={styles.column}>
              {/* A HAIRLINE BETWEEN, NOT AROUND. The first column has none, so
                  the row reads as a set rather than as a table. */}
              {i > 0 && <View style={[styles.rule, { backgroundColor: theme.background }]} />}
              <View style={styles.columnText}>
                <ThemedText type="title">{figure(m.key)}</ThemedText>
                <ThemedText type="detail" themeColor="textSecondary">
                  {m.short.toLowerCase()}
                </ThemedText>
                {child && (
                  <ThemedText type="detail" themeColor="textSecondary" style={styles.child}>
                    {figure(child)} {MACROS.find((x) => x.key === child)?.short.toLowerCase()}
                  </ThemedText>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.four, borderRadius: CardRadius, gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  heading: { flex: 1, gap: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  // WRAPS RATHER THAN SCROLLS. Six columns do not fit a phone in one line, and
  // a row that scrolls sideways hides figures behind an edge nobody taps.
  figures: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  column: { flexDirection: 'row' },
  columnText: { paddingRight: Spacing.three, gap: 1 },
  rule: { width: 1, alignSelf: 'stretch', marginRight: Spacing.three },
  child: { marginTop: 2 },
  pressed: { opacity: 0.6 },
});
