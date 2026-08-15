import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodWeekView } from '@/components/food-week-view';
import { OverviewPanel } from '@/components/overview-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { currentWeekStart, parseWeekStartParam } from '@/lib/week';

// The Dashboard destination: one screen hosting an in-screen switcher across
// facets (UNFLUMP_SPEC.md, Screen Structure). Segments appear only once built
// (principle 8): Overview (default) and Food today; Measurements and Activity
// land in later slices. The `view` and `week` route params make the switcher
// addressable from outside — a tap sets local state, and a future chat
// deep-link can hand over `?view=food&week=YYYY-MM-DD` through the same path.
const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'food', label: 'Food' },
] as const;
type SegmentKey = (typeof SEGMENTS)[number]['key'];

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ view?: string; week?: string }>();
  const initialView: SegmentKey = params.view === 'food' ? 'food' : 'overview';
  const [view, setView] = useState<SegmentKey>(initialView);

  // A `week` param (from a deep-link) addresses a specific week; otherwise the
  // current week. Memoised so the Date identity is stable across re-renders.
  const weekParam = typeof params.week === 'string' ? params.week : null;
  const weekStart = useMemo(
    () => parseWeekStartParam(weekParam) ?? currentWeekStart(),
    [weekParam]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Dashboard</ThemedText>

          <ThemedView style={styles.switcher}>
            {SEGMENTS.map((s) => {
              const active = s.key === view;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setView(s.key)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.segment}
                  >
                    <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                      {s.label}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </ThemedView>

          {view === 'overview' ? <OverviewPanel /> : <FoodWeekView weekStart={weekStart} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  switcher: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segment: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
