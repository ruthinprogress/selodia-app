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
        {open ? null : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
            {summary}
          </ThemedText>
        )}
      </Pressable>

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
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
