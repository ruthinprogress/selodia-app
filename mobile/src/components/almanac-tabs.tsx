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
              {/* ONE TYPE FOR BOTH STATES, only the colour changes. Found on
                  device 2026-09-12: switching the chosen label from the system
                  face to Comfortaa made Android keep the narrower measurement,
                  so "Insights" drew as "Insigh". Selection is shown by the
                  cream segment and the darker text, never by a font change. */}
              <ThemedText
                type="smallBold"
                numberOfLines={1}
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

// EXACT RADII, half of each height, rather than 999. Found on device 2026-09-12:
// the chosen segment drew with square corners that poked outside the rounded
// track. A segment is 36 tall (8 + 20 + 8), so 18; the track adds 3 each side, so
// 21. And the track clips, so nothing inside it can ever show past its edge.
const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 21,
    padding: 3,
    gap: 2,
    overflow: 'hidden',
  },
  tab: { flex: 1 },
  segment: {
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
