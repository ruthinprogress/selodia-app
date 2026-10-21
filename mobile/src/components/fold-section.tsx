import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A SECTION THAT FOLDS, SHARED, BECAUSE THIS IS THE THIRD ONE.
//
// The Body Manual grew folding sections on 6 October, the Me tab on 7 October,
// and Now needs three of them in the same change. A third hand-rolled copy is
// how the Log, Cycle and Plans lists ended up with four ways of arranging a
// list - which is written down in me-protocol.tsx as the reason they were made
// to share one.
//
// THE COUNT IS PART OF THE COMPONENT, NOT AN OPTION. The Body Manual learned why
// and wrote it down: a folded section showing a heading and nothing is
// "indistinguishable from an empty list", which cost an afternoon when a shut
// section read as empty. Anything that folds has to be able to say whether there
// is anything behind it, so `summary` is required rather than optional and a
// section with nothing in it says so in words.

export function FoldSection({
  title,
  summary,
  open,
  onToggle,
  children,
  ruled = false,
  hideSummary = false,
  more,
}: {
  title: string;
  /**
   * What a shut section says about its contents. Required: see above.
   *
   * A number where there is a number ("3"), and words where there is not
   * ("nothing yet", "last week"). Never empty.
   */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /**
   * A hairline above the heading, so a run of these reads as one list.
   *
   * ON THE SECTION, NOT BETWEEN THEM (Now artwork, 20 October 2026). A rule
   * drawn by the parent between children has to know which child is first,
   * which is how a list ends up with a stray line above its own heading the
   * day somebody reorders it. Each section is told whether it follows another.
   */
  ruled?: boolean;
  /**
   * Draw the row without its summary, as the Now artwork does.
   *
   * THE SUMMARY IS NOT REMOVED, ONLY UNDRAWN. It still goes into the
   * accessibility label, so a screen reader still hears "Coming up, nothing
   * yet" - which is the reading where knowing-before-opening matters most, and
   * the one that cost an afternoon on the Body Manual when a shut section was
   * "indistinguishable from an empty list".
   *
   * OPT-IN, so the Me tab and the Body Manual keep theirs. Their summaries are
   * counts of records and carry information the title does not; Now's were
   * "from Sunday's roundup" and "the last 7 days", which is a second caption
   * beside a serif heading.
   */
  hideSummary?: boolean;
  /**
   * Where the arrow at the end of the row goes, when it goes anywhere.
   *
   * Ruth, 21 October 2026, of Coming up: "the arrow on the right should take
   * them to the section where details are stored for accessing care so they
   * can call easily and see they can store those details there."
   *
   * WITHOUT THIS THE ARROW IS DECORATION. It was drawn inside the pressable
   * that opens the fold, so it did the same thing as the title - which is fine
   * as an affordance and a small lie as an arrow. Given a destination it
   * becomes its own control and says where it is going.
   */
  more?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {ruled ? <View style={[styles.rule, { backgroundColor: theme.backgroundElement }]} /> : null}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${summary}`}
        accessibilityHint={open ? 'Folds this away' : 'Shows this'}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={theme.textSecondary}
        />
        <ThemedText type="sectionTitle" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.spacer} />
        {/* ONLY WHILE IT IS SHUT (Ruth, 20 October 2026, crossing it out on her
            screenshot: "Top right header not needed at all").

            A summary exists to say what is BEHIND a shut fold. Open, the thing
            itself is on the screen - and on Balance it was repeating the pager
            two lines below it, which said "this week" in full while this one
            had been clipped to "this".

            That clipping is the "Wee" fault again: the word needs more room
            than Android measured for it, overflows, and the parent cuts it
            with no ellipsis to show for it. Not drawing it when it has nothing
            to add removes the duplicate and the clip together. */}
        {open || hideSummary ? null : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
            {summary}
          </ThemedText>
        )}
        {/* THE WAY IN, AT THE END OF THE ROW (Now artwork, 21 October 2026).
            Every row in this app that opens something carries one - the figure
            rows above, the links below - and these were the only openable
            things on the screen without it. With the summary undrawn it is
            also what keeps the row from reading as a dead heading. */}
        {hideSummary && !more ? (
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        ) : null}
      </Pressable>

      {/* ITS OWN CONTROL, OUTSIDE THE FOLD'S PRESSABLE. Nested pressables are
          how you open a panel when you meant to go somewhere - the note on
          body-modes says the same thing about Resume, and for the same
          reason. */}
      {more ? (
        <Pressable
          onPress={more.onPress}
          accessibilityRole="button"
          accessibilityLabel={more.label}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // A ROW, so the arrow can sit at the end of the heading rather than under it.
  wrap: { gap: Spacing.two },
  // Pulled up onto the heading's own line. The head below is the flexing part,
  // so this only has to hold the arrow against the right edge.
  more: { position: 'absolute', right: 0, top: 0, padding: Spacing.one },
  // The same hairline the Week's days use, in the same sand, so the two
  // screens are ruled by one line rather than by two that nearly match.
  rule: { height: 1, opacity: 0.7, marginBottom: Spacing.two },
  // The chevron, the title and the summary are one target, as they are in the
  // Body Manual and on the Me tab.
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // THE TITLE SHRINKS, NOT THE SUMMARY. This was flex: 1 on the title, which
  // squeezed the summary until "across the six dimensions" rendered as "across
  // the six" with nothing to say it had been cut. A summary is a handful of
  // words by contract; a title can be long. So the title ellipsises and the
  // summary keeps whatever it needs.
  title: { flexShrink: 1 },
  spacer: { flex: 1 },
  summary: { flexShrink: 0 },
  body: { gap: Spacing.two },
  pressed: { opacity: 0.6 },
});
