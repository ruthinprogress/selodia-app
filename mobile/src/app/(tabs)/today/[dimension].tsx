import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { DimensionDetail } from '@/components/dimension-detail';
import { useDimensionActivities } from '@/hooks/use-dimension-activities';
import { coerceDimension } from '@/lib/health-flower';

// The route. Owns the URL segment and the query; the picture lives in
// DimensionDetail so it can be rendered with fixed data.
export default function DimensionScreen() {
  const params = useLocalSearchParams<{ dimension?: string }>();
  const dimension = coerceDimension(params.dimension);
  const { activities, loading } = useDimensionActivities(dimension);

  // An unrecognised segment shows nothing rather than defaulting to a dimension
  // the person did not ask for.
  if (dimension == null) return <View style={{ flex: 1 }} />;

  return (
    <DimensionDetail dimension={dimension} activities={activities ?? []} loading={loading} />
  );
}
