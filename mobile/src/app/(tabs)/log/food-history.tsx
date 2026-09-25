import { useLocalSearchParams } from 'expo-router';

import { BodyScreen } from '@/components/body-screen';
import { ReportLink } from '@/components/report-link';
import { FoodLogView } from '@/components/food-log-view';
import { parseWeekStartParam } from '@/lib/week';

// The food log (Ruth's redesign brief, 24 September 2026). Today at the top of
// the week it belongs to, every other day collapsed underneath, one row per
// entry and nothing on the right of it.
//
// It was two screens until today - today's food in the Log tab's Food segment,
// the week-by-week history behind this route - each with its own copy of a food
// row and its own totals. One screen is what the data always was.
//
// The optional week param is why week.ts has parseWeekStartParam: a link into a
// particular week (from a roundup, say) snaps to that week's Monday, and junk
// falls back to this week rather than resolving to a wrong one.
export default function BodyFoodHistoryScreen() {
  const { week } = useLocalSearchParams<{ week?: string }>();
  const initialWeekStart = parseWeekStartParam(week) ?? undefined;

  return (
    <BodyScreen settingsInHeader title="Food & Drink">
      <FoodLogView initialWeekStart={initialWeekStart} />
      {/* Her brief: a quiet text link, not a button. */}
      <ReportLink start={['food']} label="Build a report" />
    </BodyScreen>
  );
}
