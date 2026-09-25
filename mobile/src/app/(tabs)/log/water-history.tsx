import { useState } from 'react';

import { BodyScreen } from '@/components/body-screen';
import { HydrationQuickLog } from '@/components/hydration-quick-log';
import { ReportLink } from '@/components/report-link';
import { WaterHistoryView } from '@/components/water-history-view';

// Water, week by week. A screen of its own rather than a fourth segment in the
// Log: three segments already sit at the width Ruth asked for, and a fourth
// would take "Measurements" below the size it can be read at. It is reached
// from today's drinks on the Today screen, the way the food history is reached
// from today's food.
export default function WaterHistoryScreen() {
  // A drink added here has to appear in the list underneath it straight away,
  // or the bar reads as having done nothing. The nonce is what makes the view
  // re-read rather than sit on what it fetched when the screen opened.
  const [added, setAdded] = useState(0);
  return (
    <BodyScreen title="Hydration">
      <HydrationQuickLog onLogged={() => setAdded((n) => n + 1)} />
      <WaterHistoryView key={added} />
      <ReportLink start={['water']} label="Build a report from this" />
    </BodyScreen>
  );
}
