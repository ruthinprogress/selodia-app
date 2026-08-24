import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The Almanac's empty state (build item 15, UI slice 1 — UNFLUMP_SPEC.md, Part
// Ten). Until this existed the Almanac tab rendered a title and nothing else:
// one of three destinations was a dead end, and a live exception to principle 8.
//
// The copy is verbatim from the spec and does a specific job — it frames WHY
// the page is empty and WHEN it fills, so emptiness reads as "not yet" rather
// than "broken" or "you haven't done enough". "Worth remembering" is load-
// bearing: it ties to the Result / Observation / Insight distinction, where only
// a genuine insight, saved deliberately, ever lands here.
//
// The spec also specifies a small sage line-illustration. That waits on the
// brand palette (item 37) — shipping a placeholder graphic in the wrong colours
// would be worse than shipping none, so there is deliberately no artwork yet.

export const ALMANAC_EMPTY_HEADING = 'Nothing here yet';
export const ALMANAC_EMPTY_BODY =
  "We'll build this together — the first entries appear once a pattern's worth remembering, and you've said yes to saving it.";

export function AlmanacEmptyState() {
  const theme = useTheme();

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {/* Stands in for the sage line-illustration until item 37. A quiet rule
          rather than an icon: it gives the block a centre without pretending to
          be the artwork that is still to come. */}
      <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />

      <ThemedText type="smallBold" style={styles.heading}>
        {ALMANAC_EMPTY_HEADING}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {ALMANAC_EMPTY_BODY}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  rule: {
    width: 36,
    height: 2,
    borderRadius: 1,
    marginBottom: Spacing.one,
  },
  heading: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
});
