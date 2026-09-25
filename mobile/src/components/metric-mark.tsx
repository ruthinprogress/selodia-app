import Ionicons from '@expo/vector-icons/Ionicons';

import { MeasurementIcon, measurementIcon } from '@/components/measurement-icon';
import { useTheme } from '@/hooks/use-theme';
import { SCALE_ICONS, type TrackedMetric } from '@/lib/tracked-metrics';

// THE MARK FOR ONE TRACKED MEASUREMENT, decided in one place.
//
// A tape measurement gets the app's OWN drawing - see measurement-icon.tsx,
// which is a family built to the UI brief and which says, carefully, nothing
// about what a body should look like: the torso is a rounded column, the limb a
// rounded tube, and the only thing that changes is where the band sits.
//
// It is chosen from the metric's NAME rather than stored, so it cannot be
// wrong: somebody who starts measuring their calf gets the calf drawing without
// choosing anything, and an icon name saved years ago cannot rot.
//
// THE SCALE'S THREE HAVE NO DRAWING YET and use an Ionicon each. That is the
// one outstanding piece: three marks in the same hand as the tape family.
export function MetricMark({ metric, size = 18 }: { metric: TrackedMetric; size?: number }) {
  const theme = useTheme();

  if (metric.source === 'scale' && metric.field) {
    return (
      <Ionicons
        name={SCALE_ICONS[metric.field] as never}
        size={size}
        color={theme.accentDeep}
      />
    );
  }

  return <MeasurementIcon kind={measurementIcon(metric.name ?? metric.label)} size={size} color={theme.accentDeep} />;
}
