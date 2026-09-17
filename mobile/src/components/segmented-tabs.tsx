import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// ONE SWITCH, USED BY EVERY TAB THAT HAS VIEWS INSIDE IT (2026-09-17).
//
// The Almanac's three views and the Log's three views are the same control, and
// it had already been rebuilt five times on the Almanac alone. Two copies would
// be two places for the sixth attempt to miss, so there is one, and this is what
// every one of those attempts taught:
//
//   - THE LABELS DECIDE THE WIDTH. Tabs at flex:1 divide a fixed width into
//     equal parts, and a text node will not shrink below its own min-content, so
//     the parts overflow. Here each segment is its own label plus padding, and
//     the track centres itself in whatever room there is.
//   - THE TRACK DOES NOT CLIP. overflow:'hidden' is what turned an overhang into
//     a chopped word: "Insights" drew as "Insigh", "Me" as "M".
//   - NO numberOfLines. Android replaces the WHOLE word with an ellipsis when it
//     measures text wider than its box, which is why the shortest label failed
//     hardest - there is nothing to trim, so everything goes.
//   - ONE FACE, MEASURED AND DRAWN. Android measures in the system face; asking
//     it to draw Comfortaa makes the drawn word wider than the box it was given.
//     So the label stays on the system face in both states, and selection is
//     said with the cream segment and the darker text, never with a font change.
//
// The radii are exact rather than 999: a segment is 36 tall (8 + 20 + 8) so 18,
// and the track adds 3 either side, so 21. A rounded segment inside a rounded
// track needs the two to agree, because nothing clips them into place.

export type SegmentedTabItem<T extends string> = { id: T; label: string };

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.segment, selected && { backgroundColor: theme.background }]}>
              <ThemedText
                type="small"
                themeColor={selected ? 'text' : 'textSecondary'}
                style={styles.label}
              >
                {item.label}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 21,
    padding: 3,
    gap: 2,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  tab: { flexShrink: 0 },
  segment: {
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  label: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
