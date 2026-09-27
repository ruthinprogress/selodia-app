import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RoundupFigure } from '@/lib/roundup-figures';

// THE WEEK, AS ITS OWN CARD (Ruth's item 9, 27 September 2026).
//
//   "Weekly roundup: needs a UI pass, and its content must agree with itself."
//   Its own card. Rows, not prose.
//
// WHAT SHE WAS LOOKING AT WHEN SHE ASKED. Four paragraphs in a chat bubble,
// indistinguishable from any other thing Selodia had said that week, with every
// figure buried inside a sentence:
//
//   "It's been a week of higher intake, sitting under 1,400 kcal on average, and
//    almost no movement to speak of. ... Your 10 readings show a real trend
//    downward ..."
//
// 1,222 kcal. A 32-minute run and 45 minutes of yoga. Three readings. Every
// number in that paragraph was wrong, and the shape is part of why: a figure
// inside a clause is a figure nobody checks, and the writing carried it along.
//
// SO THE ROWS DO NOT COME FROM THE PROSE. They are computed in code from her own
// stored rows - app/lib/roundup-figures.ts - and the model's words sit underneath
// as the observations they are. Parsing the paragraph into rows would have
// produced three tidy rows of the same wrong numbers. See that file's own note.
//
// WHY IT IS NOT A LINK TO THE ALMANAC. The roundup is written to her once a week
// and this is where she reads it. Sending her somewhere else to see her own week
// would turn a reflection into an errand.

export type RoundupPayload = {
  /** Which week, for the heading. */
  weekEnding?: string | null;
  /** The figures, worked out in code. Absent on roundups written before today. */
  figures?: RoundupFigure[] | null;
};

/** "Week to 27 Sept", from an ISO date. The heading a chronological log needs. */
function weekHeading(weekEnding: string | null | undefined): string {
  if (!weekEnding) return 'Your week';
  const d = new Date(weekEnding + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 'Your week';
  return `Week to ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export function RoundupCard({ payload }: { payload: RoundupPayload }) {
  const theme = useTheme();
  const figures = payload.figures ?? [];

  // NOTHING TO DRAW IS NOT AN EMPTY CARD. Every roundup written before 27
  // September 2026 has no figures stored, and those are still perfectly good
  // roundups: the bubble above this has said the whole thing. Drawing a headed
  // card with no rows under it would make an old entry look broken.
  if (figures.length === 0) return null;

  return (
    <ThemedView style={styles.wrap}>
      <ThemedText type="smallBold" style={styles.heading}>
        {weekHeading(payload.weekEnding)}
      </ThemedText>

      <ThemedView
        type="backgroundElement"
        style={[styles.table, { borderColor: theme.backgroundSelected }]}
        // One node to the screen reader, in order, with each figure attached to
        // its own label and its own note - rather than a stream of numbers whose
        // qualifications have come loose from what they qualify.
        accessibilityRole="summary"
        accessibilityLabel={`${weekHeading(payload.weekEnding)}. ${figures
          .map((f) => `${f.label}: ${f.value}${f.note ? `, ${f.note}` : ''}`)
          .join('. ')}`}
      >
        {figures.map((f, i) => (
          <View
            key={f.label}
            style={[
              styles.row,
              i < figures.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
              { borderBottomColor: theme.backgroundSelected },
            ]}
          >
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {f.label}
            </ThemedText>
            <View style={styles.valueColumn}>
              {/* WRAPPING IS THE POINT OF THE COLUMN, and it is the fault that
                  cost a day on the Log tabs at her font scale: a value that has
                  to shrink below its content width needs minWidth 0 as well as
                  flex, or it pushes the row wider than the screen instead. */}
              <ThemedText type="small" style={styles.value} selectable>
                {f.value}
              </ThemedText>
              {/* THE NOTE SITS WITH ITS OWN FIGURE, never at the top of the
                  card. "Averaging 1,222 kcal" and "over the 5 days you logged"
                  are one fact; a disclaimer at the top is read once and the
                  numbers are read again and again. */}
              {f.note ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note} selectable>
                  {f.note}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    // The assistant bubble's own inset, so the card reads as part of that turn
    // rather than as a separate announcement.
    maxWidth: '95%',
    alignSelf: 'flex-start',
    width: '100%',
  },
  heading: { paddingHorizontal: Spacing.one },
  table: { borderRadius: Spacing.three, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    // TOP, NOT CENTRE. A row whose value wraps to three lines with a note under
    // it would otherwise float its label into the middle of the block, away from
    // the line it names.
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  label: { flex: 1, minWidth: 0 },
  valueColumn: { flex: 2, minWidth: 0, gap: 2 },
  value: { textAlign: 'right' },
  note: { textAlign: 'right', lineHeight: 18 },
});
