import { BodyScreen } from '@/components/body-screen';
import { WaterHistoryView } from '@/components/water-history-view';

// Water, week by week. A screen of its own rather than a fourth segment in the
// Log: three segments already sit at the width Ruth asked for, and a fourth
// would take "Measurements" below the size it can be read at. It is reached
// from today's drinks on the Today screen, the way the food history is reached
// from today's food.
export default function WaterHistoryScreen() {
  return (
    <BodyScreen>
      <WaterHistoryView />
    </BodyScreen>
  );
}
