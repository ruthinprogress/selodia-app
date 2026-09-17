import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityView } from '@/components/activity-view';
import { BodyScreen } from '@/components/body-screen';
import { FoodTodayView } from '@/components/food-today-view';
import { LogTabs, type LogView } from '@/components/log-tabs';
import { MeasurementsView } from '@/components/measurements-view';
import { Spacing } from '@/constants/theme';
import { parseWeekStartParam } from '@/lib/week';

// THE LOG (UI brief, Part 1, 2026-09-17).
//
// Food, Activity and Measurements were three routes inside the Body tab, each a
// wrapper around the view that does the work. The brief moves them into a tab of
// their own, chosen by a switch at the top, and gives the old Body tab back to
// Today.
//
// THE VIEWS THEMSELVES ARE UNTOUCHED. This is a visual and structural pass, so
// FoodTodayView, ActivityView and MeasurementsView render exactly as they did:
// same week stepping, same day cards, same quick log, same deep link. What
// changed is which screen they hang off.
//
// `?view=` is how Today's three squares arrive: the square for food opens the
// Log on Food. Parsed once as the opening view, after which the switch drives
// it, so arriving by tap behaves the same as arriving by link.
function isView(v: unknown): v is LogView {
  return v === 'food' || v === 'activity' || v === 'measurements';
}

export default function LogScreen() {
  const params = useLocalSearchParams<{ view?: string; week?: string }>();
  const [view, setView] = useState<LogView>(isView(params.view) ? params.view : 'food');
  const initialWeekStart = parseWeekStartParam(params.week) ?? undefined;

  return (
    <BodyScreen>
      <View style={styles.tabs}>
        <LogTabs value={view} onChange={setView} />
      </View>
      {view === 'food' && <FoodTodayView />}
      {view === 'activity' && <ActivityView />}
      {view === 'measurements' && <MeasurementsView initialWeekStart={initialWeekStart} />}
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    paddingBottom: Spacing.two,
  },
});
