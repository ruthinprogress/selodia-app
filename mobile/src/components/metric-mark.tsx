import { MeasurementIcon, measurementIcon, type MeasurementIconKind } from '@/components/measurement-icon';
import { useTheme } from '@/hooks/use-theme';
import type { TrackedMetric } from '@/lib/tracked-metrics';

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
// THE SCALE'S THREE NOW HAVE ONE TOO (Ruth, 26 September 2026). They used to
// borrow an Ionicon each - a speedometer, a pie chart and a barbell - which were
// stand-ins from three different drawing sets sitting in a row beside a family
// built on purpose. The barbell was the worst of them: it is a picture of
// exercise standing in for a reading taken standing still.
//
// The whole point of that family is that every mark is the same hand, so a
// borrowed glyph is not a small inconsistency, it is the one thing the family
// exists to prevent. See measurement-icon.tsx for why these three are drawn
// differently from the tape marks rather than copying their band.
const SCALE_MARKS: Record<string, MeasurementIconKind> = {
  weight_kg: 'weight',
  body_fat_pct: 'body_fat',
  muscle_kg: 'muscle',
};

export function MetricMark({ metric, size = 18 }: { metric: TrackedMetric; size?: number }) {
  const theme = useTheme();

  const kind: MeasurementIconKind =
    (metric.source === 'scale' && metric.field ? SCALE_MARKS[metric.field] : undefined) ??
    measurementIcon(metric.name ?? metric.label);

  return <MeasurementIcon kind={kind} size={size} color={theme.accentDeep} />;
}
