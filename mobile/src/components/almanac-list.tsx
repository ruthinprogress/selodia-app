import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSeeded, type AlmanacGroup } from '@/lib/almanac-list';

// The Almanac entry list (build item 15, UI slices 2-3).
//
// Read-only by design: the Almanac is never edited in place. Tapping a row
// opens the detail view, and editing from there goes through chat, so Unflump
// stays the single writer and there is no direct-edit path to keep in sync with
// the conversational one (Part Ten, Editing).

export function AlmanacList({
  groups,
  onOpen,
  onOpenCategory,
}: {
  groups: AlmanacGroup[];
  onOpen: (id: string) => void;
  // Opening a category is optional: the heading is only a way IN to a filtered
  // view, never the only route to an entry. Every entry stays reachable from
  // this list whether or not a category page is ever visited.
  onOpenCategory?: (category: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {groups.map((g) => (
        <View key={g.category ?? '__ungrouped'} style={styles.group}>
          {/* No heading for the ungrouped remainder — see almanac-list.ts on why
              there is deliberately no "Uncategorised" label. */}
          {g.category &&
            (onOpenCategory ? (
              <Pressable
                onPress={() => onOpenCategory(g.category as string)}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${g.category} category`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="smallBold" themeColor="link" style={styles.groupHeading}>
                  {g.category}
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupHeading}>
                {g.category}
              </ThemedText>
            ))}
          {g.entries.map((e) => (
            <EntryRow
              key={e.id}
              title={e.title}
              kind={e.kind}
              seeded={isSeeded((e as unknown as { content?: unknown }).content)}
              onPress={() => onOpen(e.id)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function EntryRow({
  title,
  kind,
  seeded,
  onPress,
}: {
  title: string;
  kind: string;
  seeded: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView type="backgroundElement" style={styles.row}>
        <ThemedText type="small" style={styles.title}>
          {title}
        </ThemedText>
        <View style={styles.meta}>
          {/* `kind` is open text by design (principle 13), so this renders
              whatever word the conversation produced rather than mapping it
              onto a fixed set. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.kind}>
            {kind}
          </ThemedText>
          {seeded && (
            // Test data must never pass for something the person saved.
            <ThemedText type="small" style={[styles.seeded, { color: theme.danger }]}>
              seeded test data
            </ThemedText>
          )}
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  group: { gap: Spacing.one },
  groupHeading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.half,
  },
  row: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  title: { fontWeight: '500' },
  meta: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  kind: { fontSize: 11 },
  seeded: { fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
