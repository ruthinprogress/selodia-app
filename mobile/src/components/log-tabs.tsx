import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type LogView = 'food' | 'activity' | 'measurements';

// The Log tab's three views: Food, Activity and Measurements (UI brief, Part 1,
// 2026-09-17). One destination, three views of it, the same shape the Almanac
// already uses - not three more bottom tabs.
//
// EVERY LESSON FROM almanac-tabs.tsx IS BUILT IN HERE, because they were all
// learned the expensive way on this exact control:
//
//   - One type for both states. Switching the chosen label to a different face
//     made Android keep the narrower measurement and draw "Insights" as
//     "Insigh". Selection is the cream segment and the darker text, never a
//     font change.
//   - No numberOfLines. When Android measures a label wider than its box it
//     replaces the WHOLE word with an ellipsis, which is how "Me" became "M".
//   - The track does not clip. It sets no overflow, so a label that measures a
//     few pixels wide costs padding rather than letters. "Measurements" is the
//     longest label in the app's navigation, so this one has the least room.
const TABS: { id: LogView; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'activity', label: 'Activity' },
  { id: 'measurements', label: 'Measurements' },
];

export function LogTabs({ value, onChange }: { value: LogView; onChange: (v: LogView) => void }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="tablist"
    >
      {TABS.map((t) => {
        const selected = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.segment, selected && { backgroundColor: theme.background }]}>
              <ThemedText
                type="small"
                themeColor={selected ? 'text' : 'textSecondary'}
                style={styles.label}
              >
                {t.label}
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
    borderRadius: 14,
    padding: 3,
    gap: 3,
    alignSelf: 'center',
    // No overflow:'hidden'. See the block above: the clip was the cutter.
  },
  tab: {
    flexShrink: 1,
  },
  segment: {
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
