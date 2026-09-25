import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityView } from '@/components/activity-view';
import { BodyScreen } from '@/components/body-screen';
import { FoodLogView } from '@/components/food-log-view';
import { LogTabs, type LogView } from '@/components/log-tabs';
import { MeasurementsView } from '@/components/measurements-view';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { parseWeekStartParam } from '@/lib/week';

// FOOD, ACTIVITY AND MEASUREMENTS - the three that share a switch, because a
// person logging one often logs another in the same minute.
//
// They were the whole Log tab until 2026-09-20, when the Log became the list of
// everything that can be recorded (see index.tsx). Nothing about these three
// changed; they moved behind one row each, and the switch stayed so moving
// between them is still a tap rather than a trip back to the list.
function isView(v: unknown): v is LogView {
  return v === 'food' || v === 'activity' || v === 'measurements';
}

export default function LogEntriesScreen() {
  const params = useLocalSearchParams<{ view?: string; week?: string }>();
  const [view, setView] = useState<LogView>(isView(params.view) ? params.view : 'food');
  const initialWeekStart = parseWeekStartParam(params.week) ?? undefined;

  return (
    <BodyScreen title="Log">
      <ThemedText type="display">Log</ThemedText>
      <View style={styles.tabs}>
        <LogTabs value={view} onChange={setView} />
      </View>
      {/* The same redesigned screen the Food row opens, rather than a
          second, older drawing of the same data (24 September 2026). */}
      {view === 'food' && <FoodLogView />}
      {view === 'activity' && <ActivityView />}
      {view === 'measurements' && <MeasurementsView initialWeekStart={initialWeekStart} />}
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    marginHorizontal: -Spacing.two,
  },
});
