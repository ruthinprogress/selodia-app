import { useLocalSearchParams } from 'expo-router';

import { BodyScreen } from '@/components/body-screen';
import { MeasurementsRedesign, type MeasurementsVariant } from '@/components/measurements-redesign';
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
// BEING REDESIGNED (Ruth, 25 September 2026, from her mockup: "Do 2-3
// measurements mockups and ill decide"). Without ?variant= this screen renders
// exactly as it has been; ?variant=1, 2 or 3 render the three arrangements for
// her to look at. The param and the losing variants come out once she has
// chosen, and measurements-view.tsx goes with them.
//
// A PARAM RATHER THAN A CONSTANT, and the reason is worth keeping in mind for
// the next time three things need comparing: a compile-time switch meant a
// full Metro rebuild between every screenshot, and this machine's bundler
// degrades from fifteen seconds to seven minutes after half an hour of edits.
// Three rebuilds were costing more than the variants did to write. One bundle,
// three navigations.
function variantFrom(v: string | undefined): MeasurementsVariant | null {
  return v === '1' || v === '2' || v === '3' ? (Number(v) as MeasurementsVariant) : null;
}

export default function MeasurementsScreen() {
  const { week, variant } = useLocalSearchParams<{ week?: string; variant?: string }>();
  const initialWeekStart = parseWeekStartParam(week) ?? undefined;
  const redesign = variantFrom(variant);

  return (
    <BodyScreen title="Measurements">
      {redesign == null ? (
        <MeasurementsView initialWeekStart={initialWeekStart} />
      ) : (
        <MeasurementsRedesign variant={redesign} />
      )}
    </BodyScreen>
  );
}
