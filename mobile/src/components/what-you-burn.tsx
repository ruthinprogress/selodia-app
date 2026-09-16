import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// What you burn, minimised (Ruth, 2026-09-16).
//
// WHY IT MOVED. The BMR/TDEE numbers and their explanation lived at the foot of
// the Activity screen, where she said they were "too hidden". Her instruction was
// to bring them to the Overview - the screen titled Today - as something that
// "lived minimised on the overview page".
//
// MINIMISED IS THE WHOLE POINT, and it is what makes this fit. The Overview does
// not scroll, deliberately: its budget has already been cut twice to fit what is
// on it, once by 40px "which is most of a flower". Collapsed, this costs one
// row. Expanded, it is as long as it needs to be, because by then the person has
// asked for it.
//
// ONE COPY, NOT TWO. The Activity screen no longer carries the explainer. Two
// copies of the same three answers is how they drift apart, and the one that
// drifts is always the one nobody is looking at.

// A TITLE AND A SUBTITLE, NOT ONE SENTENCE (Ruth, 2026-09-16): "It should be
// Title: What You Burn. Then subtitle: BMR, TDEE and muscle mass relationship
// explained." The semicolon that joined them is gone, because the line break
// now does the work it was doing. Sentence case is kept, which is what every
// other heading in the app uses, and no trailing colon - a colon announcing a
// subtitle that already sits on its own line beneath it says nothing twice.
export const WHAT_YOU_BURN_TITLE = 'What you burn';
export const WHAT_YOU_BURN_SUBTITLE = 'BMR, TDEE and muscle mass relationship explained.';

// ONE SENTENCE FOR THE SCREEN READER. The control is a single button, and a
// reader announcing a title and then a fragment would split one label into two
// halves that arrive separately. Composed from the two above rather than typed
// again, so the spoken label cannot drift from the printed one.
export const WHAT_YOU_BURN_SUMMARY = `${WHAT_YOU_BURN_TITLE}. ${WHAT_YOU_BURN_SUBTITLE}`;

export const BMR_EXPLAINER = [
  {
    q: "What's basal metabolic rate (BMR)?",
    a: 'What your body burns just staying alive at complete rest: breathing, heartbeat, organ function, cell repair. The energy cost of simply existing, before you’ve moved a muscle.',
  },
  {
    q: "What's total daily energy expenditure (TDEE)?",
    a: 'Your BMR plus everything else: walking, training, digesting food, even fidgeting. TDEE is always higher than BMR; it’s BMR with your whole day layered on top.',
  },
  {
    q: 'Does building muscle raise your BMR?',
    a: 'Yes, but modestly. Research puts it at roughly 10-13 kcal a day for every kilogram of muscle gained.',
  },
];

export type BurnFigures = { bmr: number | null; tdee: number | null; estimated: boolean } | null;

export function WhatYouBurn({ figures }: { figures: BurnFigures }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <ThemedView type="backgroundElement" style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={WHAT_YOU_BURN_SUMMARY}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.summary}>
          <ThemedText type="smallBold">{WHAT_YOU_BURN_TITLE}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {WHAT_YOU_BURN_SUBTITLE}
          </ThemedText>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.accentDeep}
        />
      </Pressable>

      {open && (
        <View style={styles.body}>
          {/* The numbers first: they are the answer, and the three questions
              below are why. Absent when there is not enough to compute them,
              rather than shown as dashes - an estimate nobody can make is not
              a figure with a gap in it. */}
          {figures?.bmr != null || figures?.tdee != null ? (
            <View style={styles.numbers}>
              <Figure label="BMR" value={figures.bmr} />
              <Figure label="TDEE" value={figures.tdee} />
            </View>
          ) : null}

          {/* Said plainly rather than hidden: an estimate and a scale reading
              are not the same thing, and the person should know which she is
              looking at before she reasons from it. */}
          {figures?.estimated ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Estimated from your height, age and weight. A scale that reads BMR directly gives a
              closer figure.
            </ThemedText>
          ) : null}

          {BMR_EXPLAINER.map((item) => (
            <View key={item.q} style={styles.item}>
              <ThemedText type="smallBold">{item.q}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.a}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </ThemedView>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.figure}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value != null ? `${Math.round(value)} kcal` : '—'}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  // Takes the slack so the chevron keeps its place at the right edge. Now a
  // column of two lines rather than one Text, so the gap is what separates the
  // title from the line explaining it.
  summary: { flexShrink: 1, gap: Spacing.half },
  body: { gap: Spacing.two, paddingTop: Spacing.two },
  numbers: { flexDirection: 'row', gap: Spacing.six },
  figure: { gap: Spacing.half },
  note: { fontStyle: 'italic' },
  item: { gap: Spacing.half },
  pressed: { opacity: 0.7 },
});
