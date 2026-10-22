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

      {/* A GRID OF THREE, NOT A WRAPPING ROW (22 October 2026, her screenshot
          and one word: "This is not good").

          THREE THINGS WERE WRONG AND TWO WERE THE SAME MISTAKE. The figures
          were `title`, which is 32px - a size meant for a screen's name, used
          eight times in one card, so the card ate the page and left one day
          visible underneath it. And the hairlines were drawn before every
          column except the very first, which is correct for ONE row and wrong
          for every row after it: each wrapped line began with a rule hanging
          off its left edge.

          A fixed three-column grid fixes both. The rule belongs to a cell's
          LEFT edge and is drawn only when the cell is not first in its row,
          which is arithmetic on the index rather than on where the text
          happened to wrap. */}
      {/* SMALLER AGAIN, AND NO RULES (22 October 2026, second attempt: "Its
          still huge and overbearing").

          The first fix took the figures from 32px to 22px and kept three to a
          row, which is still eight large numbers stacked three rows deep - a
          card taller than the log it sits above. Two rounds of trimming a size
          was the wrong move: the problem is that EIGHT FIGURES CANNOT BE BIG.
          Her artwork fits six in one row precisely because they are small.

          So: four to a row, seventeen point, and the hairlines gone. The rules
          were the artwork's, drawn around six figures in a single line where
          they separate; around a grid they are a lattice, and a lattice is
          weight. Whitespace separates these perfectly well and weighs nothing,
          which is the whole of what "overbearing" was describing.

          It also deletes a bug class rather than fixing one: with no rules
          there is no index arithmetic, so there is no row that can begin with
          a dangling one. */}
      <View style={styles.figures}>
        {columns.map((m) => {
          const child = (Object.keys(UNDER) as MacroKey[]).find(
            (k) => UNDER[k] === m.key && tracked.includes(k) && figure(k)
          );
          return (
            <View key={m.key} style={styles.cell}>
              <ThemedText type="small" style={styles.figure}>
                {figure(m.key)}
              </ThemedText>
              <ThemedText type="detail" themeColor="textSecondary" style={styles.label}>
                {m.short.toLowerCase()}
              </ThemedText>
              {child && (
                <ThemedText type="detail" themeColor="textSecondary" style={styles.label}>
                  {figure(child)} {MACROS.find((x) => x.key === child)?.short.toLowerCase()}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

/** Four to a row. Eight figures is two lines, which is a card rather than a page. */
const PER_ROW = 4;

const styles = StyleSheet.create({
  // Tighter than a normal card: this one is read on the way past.
  card: { padding: Spacing.three, borderRadius: CardRadius, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  heading: { flex: 1, gap: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  cell: { width: `${100 / PER_ROW}%`, paddingRight: Spacing.two },
  // SIXTEEN, AND SIZED AGAINST THE LOG RATHER THAN AGAINST A SCALE (Ruth,
  // 22 October 2026): "They only need to be a tiny bit bigger than the food log
  // table text font size."
  //
  // That is the sentence I should have started from. The day rows beneath this
  // card are `small`, which is 14, so the card's figures sit one step above the
  // thing they summarise and no further. Three goes at this - 32, then 22, then
  // 17 - were all me choosing a size in the abstract and asking whether it
  // looked big. The right question was what it had to be bigger THAN.
  figure: { fontSize: 16, lineHeight: 20 },
  label: { lineHeight: 15 },
  pressed: { opacity: 0.6 },
});
