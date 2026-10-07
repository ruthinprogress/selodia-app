import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Layer 1 of Insights: the living portrait (build spec, Part Ten, the Insights
// brief).
//
// THE FLOWER WAS REMOVED FROM HERE ON 7 OCTOBER 2026, at Ruth's word: "Remove
// the health flower that's at the top of the almanac insights tab."
//
// WHY IT WAS ALWAYS GOING TO GO. For twelve days this tab drew two flowers. This
// one was THIS WEEK's coverage at 230px, the same picture the Body tab already
// shows; below it sat the balance flower, which she moved here herself on
// 25 September as a SIX-WEEK rolling view, and which she chose six weeks for
// because "a week is short enough that an ordinary busy week looks like a bare
// drawing". So the tab opened on the harshest reading of her last seven days and
// then, a scroll later, showed the kinder one it was meant to show.
//
// Two drawings of the same thing on one screen also means the one at the top
// wins, whatever the one underneath is for. The Almanac is the tab for patterns.
// A week is not a pattern.
//
// WHAT THIS LEAVES, which is what the layer was named for: the witness
// statements, written by the Sunday roundup, and the period they describe. The
// portrait is the picture written in WORDS. It was the thing underneath the
// flower, and it is the thing now.
//
// The flower itself is untouched and still lives on the Body tab and in
// balance-flower-section.tsx below this. Nothing was deleted, it was removed
// from one screen.

export const PORTRAIT_EMPTY =
  "We're just getting started. Log a few weeks and we'll start to see your picture emerge.";

export type InsightsPortraitProps = {
  /** Written by the Sunday roundup, read from the newest roundup entry. */
  statements?: string[];
  /** The period they describe, as the roundup recorded it ("the last 6 weeks"). */
  range?: string | null;
};

export function InsightsPortrait({ statements = [], range = null }: InsightsPortraitProps) {
  return (
    <View style={styles.wrap}>
      {/* THE WIDTH LIMIT SITS ON A WRAPPER, NOT ON THE TEXT. Found on device
          2026-09-12: with maxWidth and centring on the Text itself, Android
          measured Comfortaa short by a line and dropped "picture emerge." off
          the end of Ruth's sentence. The wrapper holds the width, the text
          fills it, and the line height has a little room for Comfortaa's tall
          letters. */}
      <View style={styles.statementWrap}>
        {statements.length > 0 ? (
          <>
            {statements.map((line) => (
              <ThemedText key={line} style={styles.statement}>
                {line}
              </ThemedText>
            ))}
            {/* The period is stated, so the reflection is never mistaken for
                all of time or for this week alone (the brief asks for it). */}
            {range && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.range}>
                {range}
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.statement}>
            {PORTRAIT_EMPTY}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  statementWrap: {
    width: '100%',
    maxWidth: 320,
  },
  statement: {
    width: '100%',
    textAlign: 'center',
    lineHeight: 26,
  },
  // The period the statements describe, quieter than the statements themselves:
  // it is a label on the reflection, not part of it.
  range: {
    width: '100%',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
