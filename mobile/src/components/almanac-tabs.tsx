import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { AlmanacTab } from '@/lib/insights';

// The Almanac's three views: Insights, Movement and Me (build spec, Part Ten, the
// Almanac redesign of 2026-09-12).
//
// A switch across the top of the one Almanac screen, NOT three more bottom tabs.
// Part Five keeps the app to three destinations, and these are three views of
// one of them, not three new places to go.
//
// Light by design: a sand track with the chosen view lifted onto cream. The
// brand is light, and charcoal is only ever text (Part Fifteen).

const TABS: { id: AlmanacTab; label: string }[] = [
  { id: 'insights', label: 'Insights' },
  { id: 'movement', label: 'Movement' },
  { id: 'me', label: 'Me' },
];

export function AlmanacTabs({
  value,
  onChange,
}: {
  value: AlmanacTab;
  onChange: (tab: AlmanacTab) => void;
}) {
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
                type={selected ? 'smallBold' : 'small'}
                style={{ color: selected ? theme.text : theme.textSecondary }}
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
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  tab: { flex: 1 },
  segment: {
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
