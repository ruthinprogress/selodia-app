import { useLocalSearchParams } from 'expo-router';

import { BodyScreen } from '@/components/body-screen';
import { MeasurementsView } from '@/components/measurements-view';
import { parseWeekStartParam } from '@/lib/week';

// `?week=` lands here rather than on the tab root, which is where it used to
// arrive before being handed down through a segment switcher. Measurements owns
// the weekly table, so the deep link now addresses the screen that answers it.
// Parsed once as the opening week; after that the screen's own stepping drives
// it, so arriving by link behaves exactly like arriving by tap.
export default function BodyMeasurementsScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const initialWeekStart = parseWeekStartParam(params.week) ?? undefined;

  return (
    <BodyScreen>
      <MeasurementsView initialWeekStart={initialWeekStart} />
    </BodyScreen>
  );
}
