import { useLocalSearchParams } from 'expo-router';

import { BodyScreen } from '@/components/body-screen';
import { MeasurementsView } from '@/components/measurements-view';
import { parseWeekStartParam } from '@/lib/week';

// Measurements, on its own route at last (Ruth, 25 September 2026).
//
// It was the last screen still reached through /log/entries, the combined
// Food/Activity/Measurements screen with a switch across the top. Everything
// else in the Log - water, sleep, feeling, cycle, food - had moved to a route
// of its own, so the switch survived on exactly two screens and said something
// untrue about them: that food, activity and measurements are a tier above how
// somebody slept or how they felt. Her words: "it implies these items are
// higher status tracking items than mood or sleep. They may not be for some."
//
// The week param is kept because the roundup links into a particular week.
export default function MeasurementsScreen() {
  const { week } = useLocalSearchParams<{ week?: string }>();
  const initialWeekStart = parseWeekStartParam(week) ?? undefined;

  return (
    <BodyScreen title="Measurements">
      <MeasurementsView initialWeekStart={initialWeekStart} />
    </BodyScreen>
  );
}
