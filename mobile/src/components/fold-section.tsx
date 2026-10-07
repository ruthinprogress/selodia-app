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
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
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
        <ThemedText type="sectionTitle" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {summary}
        </ThemedText>
      </Pressable>

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // The chevron, the title and the summary are one target, as they are in the
  // Body Manual and on the Me tab.
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, minWidth: 0 },
  body: { gap: Spacing.two },
  pressed: { opacity: 0.6 },
});
