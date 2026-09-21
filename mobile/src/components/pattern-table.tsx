import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { wordFor } from '@/lib/daily-ratings';
import {
  cell,
  comparisonLine,
  dayLabel,
  offsetLabel,
  patternHeading,
  type PatternPayload,
  windowLine,
} from '@/lib/pattern-table';

// HER OWN DAYS, SIDE BY SIDE (21 September 2026).
//
//   "catching things like low mood always 2 days after cocktails eg, could
//   genuinely be unknown to a user and needs something to check if Ai says it.
//   Also, could the user say, run a report on all days i drank cocktails and my
//   mood the following days?"
//
// A REAL TABLE, NOT PROSE, for the same reason the food breakdown is one: the
// chat has no markdown renderer, and a list of days read out in a sentence is
// unreadable by the fourth day. It is also the only honest shape here - eleven
// rows where three fit the story and eight do not looks like what it is, and a
// paragraph would not.
//
// EVERY DAY THAT DID NOT FIT STAYS IN. There is no filtering, no "showing the
// clearest examples", no sorting by how well a day supports a conclusion. That
// is the entire difference between a tool for checking a hunch and a tool for
// confirming one.
//
// AND IT SAYS WHAT IT SEARCHED. The window and the search term are printed
// under the table, so a search that found the wrong thing - "wine" catching a
// wine sauce - is visible rather than buried inside an average.

export function PatternTable({ payload }: { payload: PatternPayload }) {
  const theme = useTheme();
  if (!payload || payload.rows.length === 0) {
    // NOTHING FOUND IS STILL AN ANSWER, and it belongs in the thread rather
    // than only in the reply, because "no days on record" and "the app did not
    // do anything" look identical when nothing is drawn.
    return (
      <ThemedView style={styles.wrap}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {payload?.verdict?.standing} {payload ? windowLine(payload) : ''}
        </ThemedText>
      </ThemedView>
    );
  }

  const heading = patternHeading(payload.trigger, payload.measure, payload.offsets);
  const comparison = comparisonLine(payload, wordFor);

  return (
    <ThemedView style={styles.wrap}>
      <ThemedText type="smallBold" style={styles.heading}>
        {heading}
      </ThemedText>

      <ThemedView
        type="backgroundElement"
        style={[styles.table, { borderColor: theme.backgroundSelected }]}
        // One node to the screen reader, in order, rather than a stream of
        // loose words with no idea which day they belong to.
        accessibilityRole="summary"
        accessibilityLabel={`${heading}. ${payload.rows
          .map(
            (r) =>
              `${dayLabel(r.day)}: ${r.after
                .map((v, i) => `${offsetLabel(payload.offsets[i] ?? i)} ${cell(payload.measure, v, wordFor)}`)
                .join(', ')}`
          )
          .join('. ')}`}
      >
        <View style={[styles.row, styles.headerRow, { borderBottomColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cellDay}>
            Day
          </ThemedText>
          {payload.offsets.map((o) => (
            <ThemedText key={o} type="smallBold" themeColor="textSecondary" style={styles.cellValue}>
              {offsetLabel(o)}
            </ThemedText>
          ))}
        </View>

        {payload.rows.map((r, i) => (
          <View
            key={r.day}
            style={[
              styles.row,
              i < payload.rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
              { borderBottomColor: theme.backgroundSelected },
            ]}
          >
            <ThemedText type="small" style={styles.cellDay} selectable>
              {dayLabel(r.day)}
            </ThemedText>
            {r.after.map((v, at) => (
              <ThemedText
                key={`${r.day}-${at}`}
                type="small"
                themeColor={v == null ? 'textSecondary' : 'text'}
                style={styles.cellValue}
                selectable
              >
                {cell(payload.measure, v, wordFor)}
              </ThemedText>
            ))}
          </View>
        ))}
      </ThemedView>

      {comparison && (
        <ThemedText type="small" style={styles.note}>
          {comparison}
        </ThemedText>
      )}

      {/* THE SIZE OF THE EVIDENCE, ALWAYS, and never a conclusion drawn from
          it. Three matching days is a coincidence; the app says so in the same
          breath as it shows them. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {payload.verdict.standing}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {windowLine(payload)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    // Matches the assistant bubble's inset so it reads as part of that turn.
    maxWidth: '95%',
    alignSelf: 'flex-start',
    width: '100%',
  },
  heading: { paddingHorizontal: Spacing.one },
  table: { borderRadius: Spacing.three, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: { borderBottomWidth: StyleSheet.hairlineWidth },
  cellDay: { flex: 1.4 },
  cellValue: { flex: 1, textAlign: 'right' },
  note: { paddingHorizontal: Spacing.one, lineHeight: 18 },
});
