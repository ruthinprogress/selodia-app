import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A GROUP THAT OPENS, LIKE HEALTH CONNECT'S OWN (Ruth, 24 October 2026).
//
//   "there are too many permissions in one long list, even health connect has
//    then as grouped in drop downs, we need to do the same, ux is awful atm"
//
// Twenty-four types is the honest list - she asked for nothing to be omitted -
// but honest and readable are two different jobs, and laying all of them out
// at once made the screen a scroll rather than an answer.
//
// SHUT, EACH GROUP SAYS THE THING SOMEBODY CAME FOR: its name, and how many of
// its types are arriving. That is the whole question - "is my phone sending
// this?" - answered six times on one screen without opening anything.
//
// IT COPIES HEALTH CONNECT DELIBERATELY. This screen sits one tap from Health
// Connect's own permission list, and somebody moving between the two should not
// have to learn two ways of reading the same information. Matching a pattern
// the platform already taught them is worth more here than any idea of ours.

export function TrackingGroup({
  title,
  icon,
  /** "2 of 6 arriving", or "Not enabled" when none are. */
  summary,
  /** Open on first render - used for the one group that has something live. */
  startOpen = false,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  summary: string;
  startOpen?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(startOpen);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${summary}`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView type="backgroundElement" style={[styles.head, open && styles.headOpen]}>
          <Ionicons name={icon} size={20} color={theme.textSecondary} />
          <View style={styles.headText}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              {summary}
            </ThemedText>
          </View>
          {/* HER RULE, 14 October 2026: shut points AT the heading, open
              points DOWN. chevron-up is never an expander in this app, which
              is what makes the rule checkable rather than a matter of reading
              each condition's sense. */}
          <Ionicons
            name={open ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={theme.textSecondary}
          />
        </ThemedView>
      </Pressable>

      {open ? (
        <ThemedView type="backgroundElement" style={styles.body}>
          {children}
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.two },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: CardRadius,
  },
  // Square the join when it is open, so the head and the rows read as one card
  // rather than as two stacked ones.
  headOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  headText: { flex: 1, gap: 1 },
  body: {
    borderBottomLeftRadius: CardRadius,
    borderBottomRightRadius: CardRadius,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  pressed: { opacity: 0.6 },
});
