import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NutrientGrid } from '@/components/nutrient-grid';
import { WeekStepper } from '@/components/week-stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  COLOUR_EXPLAINER,
  STANDING_COLOUR,
  STANDING_LABEL,
  STANDING_NOTE,
  type NutrientProfile,
  type Standing,
} from '@/lib/nutrient-standing';
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
  profile,
  weekStart,
  onWeekStart,
  isPresent,
  onJump,
}: {
  /** The per-day average for each macro, keyed by column, already divided. */
  averages: Record<string, number>;
  tracked: MacroKey[];
  daysLogged: number;
  /** Her age and her two self-set targets, for the grid below the figures. */
  profile: NutrientProfile;
  /** The week the card is describing, and the control that changes it. */
  weekStart: Date;
  onWeekStart: (d: Date) => void;
  isPresent: boolean;
  onJump?: () => void;
}) {
  const theme = useTheme();
  const [explaining, setExplaining] = useState(false);

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
        {/* THE WEEK, IN THE CARD, AS DRAWN (Ruth, 24 October 2026: "Do it like
            the artwork"). It is the same control the day list used to draw
            below, moved rather than copied - see week-stepper.tsx for why a
            second one would have been a bug rather than a duplicate. */}
        <View style={styles.headRight}>
          <WeekStepper
            weekStart={weekStart}
            onWeekStart={onWeekStart}
            isPresent={isPresent}
            onJump={onJump}
          />
          {/* THE "i", HOLDING THE SECTION SHE LIKED. It replaces the "What
              these mean" link that used to sit here, and that is a trade worth
              stating: the link went to the generic list of nutrients, which is
              the thing she said the follow-through screens had been fobbed off
              with. Meaning now lives on each nutrient's own screen, one chevron
              away in the grid below, and the i holds what the colours mean. */}
          <Pressable
            onPress={() => setExplaining((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="What the colours mean"
            accessibilityState={{ expanded: explaining }}
            hitSlop={Spacing.three}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons
              name={explaining ? 'close-outline' : 'information-circle-outline'}
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <NutrientGrid values={averages} tracked={tracked} profile={profile} />

      {explaining ? <ColourExplainer /> : null}
    </ThemedView>
  );
}

/** Her artwork's legend section, word for word, shown only when asked for. */
function ColourExplainer() {
  return (
    <ThemedView type="background" style={styles.explainer}>
      <ThemedText type="smallBold">{COLOUR_EXPLAINER.title}</ThemedText>
      <ThemedText type="detail" themeColor="textSecondary" style={styles.para}>
        {COLOUR_EXPLAINER.basis}
      </ThemedText>

      {(['in-range', 'a-little-low', 'lower', 'higher'] as Standing[]).map((s) => (
        <View key={s} style={styles.state}>
          <View style={[styles.swatch, { backgroundColor: STANDING_COLOUR[s] }]} />
          <View style={styles.stateText}>
            <ThemedText type="detail">{STANDING_LABEL[s]}</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              {STANDING_NOTE[s]}
            </ThemedText>
          </View>
        </View>
      ))}

      <ThemedText type="smallBold" style={styles.whyHead}>
        {COLOUR_EXPLAINER.whyTitle}
      </ThemedText>
      <ThemedText type="detail" themeColor="textSecondary" style={styles.para}>
        {COLOUR_EXPLAINER.why}
      </ThemedText>
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
  headRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  explainer: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  para: { lineHeight: 17 },
  state: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  stateText: { flex: 1 },
  swatch: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  whyHead: { marginTop: Spacing.two },
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
