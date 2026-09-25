import { useLocalSearchParams } from 'expo-router';

import { ActivityHistoryView } from '@/components/activity-history-view';
import { BodyScreen } from '@/components/body-screen';
import { ReportLink } from '@/components/report-link';
import { parseWeekStartParam } from '@/lib/week';

// The activity log, week by week. The food history's sibling, one level in from
// Activity, for the same reason: the segment is what you open to log and to see
// what you have just done, and walking back through the weeks is a different
// errand that deserves its own back button.
export default function BodyActivityHistoryScreen() {
  const { week } = useLocalSearchParams<{ week?: string }>();
  const initialWeekStart = parseWeekStartParam(week) ?? undefined;

  return (
    <BodyScreen title="Activity">
      <ActivityHistoryView initialWeekStart={initialWeekStart} />
      <ReportLink start={['activity']} label="Build a report from this" />
    </BodyScreen>
  );
}
