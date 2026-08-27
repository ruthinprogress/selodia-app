import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityView } from '@/components/activity-view';
import { FoodTodayView } from '@/components/food-today-view';
import { MeasurementsView } from '@/components/measurements-view';
import { OverviewPanel } from '@/components/overview-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseWeekStartParam } from '@/lib/week';

// The Dashboard destination: one screen hosting an in-screen switcher across
// facets (UNFLUMP_SPEC.md, Screen Structure). Segments appear only once built
// (principle 8): Overview (default), Food today, and Measurements; Activity
// lands in a later slice. The `view` and `week` route params make the switcher
// addressable from outside — a tap sets local state, and a chat deep-link can
// hand over `?view=measurements&week=YYYY-MM-DD` through the same path.
const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'food', label: 'Food' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'activity', label: 'Activity' },
] as const;
type SegmentKey = (typeof SEGMENTS)[number]['key'];

// A route param is untrusted text; anything unrecognised falls back to the
// default rather than rendering a blank segment.
function isSegmentKey(v: string | undefined): v is SegmentKey {
  return SEGMENTS.some((s) => s.key === v);
}

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ view?: string; week?: string }>();
  const initialView: SegmentKey = isSegmentKey(params.view) ? params.view : 'overview';
  const [view, setView] = useState<SegmentKey>(initialView);

  // `?week=` addresses the weekly table, which now has a home: Measurements
  // owns it (item 38). Parsed once as the view's opening week — after that the
  // segment's own stepping drives it, so a deep-link lands somewhere and then
  // behaves exactly like arriving by tap.
  const initialWeekStart = parseWeekStartParam(params.week) ?? undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
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

          {view === 'overview' ? (
            <OverviewPanel />
          ) : view === 'food' ? (
            <FoodTodayView />
          ) : view === 'measurements' ? (
            <MeasurementsView initialWeekStart={initialWeekStart} />
          ) : (
            <ActivityView />
          )}
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
