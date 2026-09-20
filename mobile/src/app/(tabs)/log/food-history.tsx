import { useLocalSearchParams } from 'expo-router';

import { BodyScreen } from '@/components/body-screen';
import { ReportLink } from '@/components/report-link';
import { FoodHistoryView } from '@/components/food-history-view';
import { parseWeekStartParam } from '@/lib/week';

// The food log, week by week. A screen rather than a mode of the Food segment:
// today's log is what someone opens Food to do, and a browsable history is a
// different errand that deserves its own back button.
//
// The optional week param is why week.ts has parseWeekStartParam: a link into a
// particular week (from a roundup, say) snaps to that week's Monday, and junk
// falls back to this week rather than resolving to a wrong one.
export default function BodyFoodHistoryScreen() {
  const { week } = useLocalSearchParams<{ week?: string }>();
  const initialWeekStart = parseWeekStartParam(week) ?? undefined;

  return (
    <BodyScreen>
      <FoodHistoryView initialWeekStart={initialWeekStart} />
      <ReportLink start={['food']} label="Build a report from this" />
    </BodyScreen>
  );
}
